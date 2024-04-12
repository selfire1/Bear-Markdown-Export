import { Database } from "bun:sqlite";
import type { BearNote, BearAsset, MappedNote } from "./types";
import { getDynamicFiles } from "./dynamic-files";
import graymatter from "gray-matter";
import path from "path";
import os from "os";
import fs from "fs";
import cliProgress from "cli-progress";
import getOptions from "./options";

const home = os.homedir();
const options = getOptions();
const EXPORT_DIR = path.join(home, options.exportDir.notes);
const EXPORT_DIR_IMAGES = path.join(EXPORT_DIR, options.exportDir.images);

const BEAR_DB_PATH = path.join(
  os.homedir(),
  "/Library/Group Containers/9K33E3U3T4.net.shinyfrog.bear/Application Data/database.sqlite",
);
const BEAR_ASSETS_PATH = path.join(
  os.homedir(),
  "/Library/Group Containers/9K33E3U3T4.net.shinyfrog.bear/Application Data/Local Files/Note Images",
);

const args = process.argv;
const isPublishOnly = args.includes("--publish-only");
console.log("--- config ---");
console.log("publish only:", isPublishOnly);
console.log("--------------");

clearDirectories([EXPORT_DIR]);

const { notes, assets } = getNotesAndAssetsFromDb();
const assetMap = getAssetMap(assets);

const mappedNotes = mapNotes(notes);
const notesToExport = getNotesWithoutExcludeTags(
  mappedNotes,
  options.tags.exclude,
);

const { amtWritten, notes: updatedNotes } = copyUsedBearAssets(notesToExport);
console.info("Images written:", amtWritten);
await writeNotes(updatedNotes);

console.log("Writing dynamic files");

await writeQueryFiles();

async function writeQueryFiles() {
  const dynamicFiles = getDynamicFiles(updatedNotes);
  for await (const el of dynamicFiles) {
    await el.writeFile();
  }
}

async function writeNotes(notes: MappedNote[]) {
  const barNotes = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic,
  );

  barNotes.start(notes.length, 0);
  console.time("Written Notes");
  for await (const el of notes) {
    const isNoteInOptionsIgnored = options.ignoreNotes.includes(el.title);
    const notePath =
      el.title === options.quartz.indexTitle
        ? path.join(EXPORT_DIR, "index.md")
        : path.join(EXPORT_DIR, el.folder, `${el.title}.md`);
    try {
      barNotes.increment();
      if ([options.dryRun, isNoteInOptionsIgnored].some(Boolean)) {
        continue;
      }
      await Bun.write(notePath, el.content);
    } catch (e) {
      console.warn("Error writing", el.title, e);
    }
  }
  barNotes.stop();
  console.timeEnd("Written Notes");
}

function copyUsedBearAssets(notes: MappedNote[]) {
  let assetsWritten: string[] = [];
  notes.forEach(async (el) => {
    const isPublished = options.quartz.onlyWritePublishedAssets
      ? el.content.includes("publish: true")
      : true;
    if (!assetMap.has(el.id) || !isPublished) {
      return;
    }
    const bearAssets = assetMap.get(el.id);

    await bearAssets.forEach(async (bearAssetPath: string) => {
      const basenameOrig = path.basename(bearAssetPath);
      const sameNameWasWritten = assetsWritten.includes(basenameOrig);

      const nameNoExtension = path.parse(basenameOrig).name;
      const extension = path.extname(basenameOrig);
      const imageName = sameNameWasWritten
        ? `${nameNoExtension}_${assetsWritten.length}${extension}`
        : basenameOrig;

      if (sameNameWasWritten) {
        el.content = el.content.replace(
          `![](${basenameOrig})`,
          `![](${imageName})`,
        );
      }

      const newImgPath = path.join(EXPORT_DIR_IMAGES, imageName);
      assetsWritten.push(imageName);

      // copy files
      const file = Bun.file(bearAssetPath);
      try {
        assetsWritten.push(imageName);
        if (options.dryRun) {
          return;
        }
        await Bun.write(newImgPath, file);
      } catch (error) {
        console.error(error);
      }
    });
  });
  return { amtWritten: assetsWritten.length, notes };
}

function getNotesWithoutExcludeTags(
  notes: MappedNote[],
  excludeTags: string[],
) {
  return notes.filter((el) =>
    excludeTags.every(
      (exclude) => !el.tags.some((tag) => tag.startsWith(exclude)),
    ),
  );
}

function mapNotes(notes: BearNote[]): MappedNote[] {
  const rootFolders = options.tags.treatAsFolders.map((el) => el.toLowerCase());
  const regTags = /\#([.\w\/\-]+)[ \n]?(?!([\/ \w]+\w[#]))/g;
  const regFolderTags = /\#(\d{2}.+?)\#/g;

  const allNotes = notes.reduce((acc: MappedNote[], current: BearNote) => {
    const frontmatter = getFrontmatter(current.ZTEXT);
    if (isPublishOnly && !frontmatter?.publish) {
      return acc;
    }

    const folderMatches = [...current.ZTEXT.matchAll(regFolderTags)].map(
      (el) => el[1],
    );
    const folders = folderMatches.filter((match) =>
      rootFolders.some(
        (folder) =>
          `${match.toLowerCase()}/`.startsWith(folder) ||
          folder === match.toLowerCase(),
      ),
    );
    if (folders.length > 1) {
      console.warn("Too many folders in", current.ZTITLE, ":", folders);
    }
    const folder = folders?.length ? folders[0] : "";
    if (folder) {
      let contentWithoutFolderTag = current.ZTEXT.replaceAll(
        `\n#${folders[0]}#\n`,
        "",
      );
      contentWithoutFolderTag = current.ZTEXT.replaceAll(`#${folders[0]}#`, "");
      current.ZTEXT = contentWithoutFolderTag;
    }

    if (!current.ZTITLE) {
      console.warn("No title in", current.ZTEXT, "id:", current.Z_PK);
    }

    const note: MappedNote = {
      content: current.ZTEXT,
      title: current.ZTITLE,
      tags: [...current.ZTEXT.matchAll(regTags)].map((el) => el[1]),
      id: current.Z_PK,
      folder,
      date: {
        created: cocoaCoreDataTimestampToDate(current.ZCREATIONDATE),
        modified: cocoaCoreDataTimestampToDate(current.ZMODIFICATIONDATE),
      },
      frontmatter,
    };
    acc.push(note);
    return acc;
  }, [] as MappedNote[]);
  return allNotes;
}

function getFrontmatter(fileContent: string) {
  const { data } = graymatter(fileContent);
  return data;
}

function cocoaCoreDataTimestampToDate(timestamp: number) {
  if (!timestamp) {
    throw new Error("No timestamp");
  }
  const timestampInNanoSecondsEpoch = new Date(timestamp * 1000).getTime();
  const epochOffset = new Date("2001-01-01 00:00:00 -0000").getTime();
  return new Date(timestampInNanoSecondsEpoch + epochOffset);
}

function getAssetMap(assets) {
  let bearAssetsMap = new Map();
  // construct a map of shape { noteId: [assetsPaths] }
  assets.forEach((el) => {
    // Map has entry for this note, append to paths array
    if (bearAssetsMap.has(el.ZNOTE)) {
      bearAssetsMap
        .get(el.ZNOTE)
        .push(path.join(BEAR_ASSETS_PATH, el.ZUNIQUEIDENTIFIER, el.ZFILENAME));
      return;
    }
    // Map has no entry for this note, start new array
    bearAssetsMap.set(el.ZNOTE, [
      path.join(BEAR_ASSETS_PATH, el.ZUNIQUEIDENTIFIER, el.ZFILENAME),
    ]);
  });
  return bearAssetsMap;
}

function clearDirectories(dirs: string[]) {
  dirs.forEach((dir) => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

function getNotesAndAssetsFromDb(): { notes: BearNote[]; assets: BearAsset[] } {
  // connect to bear database
  const db = new Database(BEAR_DB_PATH, { readonly: true });

  const query = db.query(
    // query from https://github.com/andymatuschak/Bear-Markdown-Export/tree/master
    "SELECT Z_PK, ZTEXT, ZTITLE, ZCREATIONDATE, ZMODIFICATIONDATE FROM `ZSFNOTE` WHERE `ZTRASHED` LIKE '0' AND `ZARCHIVED` LIKE '0'",
  );
  const result = query.all() as BearNote[];
  // Get assets
  const assetsQuery = db.query(
    "SELECT ZUNIQUEIDENTIFIER, ZNOTE, ZFILENAME FROM `ZSFNOTEFILE` WHERE `ZDOWNLOADED` LIKE '1' AND `ZUNUSED` LIKE '0'",
  );
  const assetsResult = assetsQuery.all() as BearAsset[];

  // close database
  db.close();
  return { notes: result, assets: assetsResult };
}
