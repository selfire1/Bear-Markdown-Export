import { Database } from "bun:sqlite";
import type { BearNote, BearAsset, MappedNote } from "./types";
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

clearDirectories([EXPORT_DIR]);

const { notes, assets } = getNotesAndAssetsFromDb();
const assetMap = getAssetMap(assets);

const mappedNotes = mapNotes(notes);
const notesToExport = getNotesWithoutExcludeTags(
  mappedNotes,
  options.tags.exclude,
);

const { amtWritten, notes: updatedNotes } = copyUsedBearAssets(notesToExport);
console.log("Images written:", amtWritten);
await writeNotes(updatedNotes);

async function writeNotes(notes: MappedNote[]) {
  const barNotes = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic,
  );

  barNotes.start(notes.length, 0);
  console.time("Written Notes");
  for await (const el of notes) {
    const notePath =
      el.title === options.quartz.indexTitle
        ? path.join(EXPORT_DIR, "index.md")
        : path.join(EXPORT_DIR, el.folder, `${el.title}.md`);
    try {
      await Bun.write(notePath, el.content);
      barNotes.increment();
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
    const isPublished = el.content.includes("publish: true");
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
        await Bun.write(newImgPath, file);
        assetsWritten.push(imageName);
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
  const allNotes = notes.map((el) => {
    const folderMatches = [...el.ZTEXT.matchAll(regFolderTags)].map(
      (el) => el[1],
    );
    // console.log(folderMatches);
    const folders = folderMatches.filter((match) =>
      rootFolders.some(
        (folder) =>
          `${match.toLowerCase()}/`.startsWith(folder) ||
          folder === match.toLowerCase(),
      ),
    );
    if (folders.length > 1) {
      console.warn("Too many folders in", el.ZTITLE, ":", folders);
    }
    const folder = folders?.length ? folders[0] : "";
    if (folder) {
      let contentWithoutFolderTag = el.ZTEXT.replaceAll(
        `\n#${folders[0]}#\n`,
        "",
      );
      contentWithoutFolderTag = el.ZTEXT.replaceAll(`#${folders[0]}#`, "");
      el.ZTEXT = contentWithoutFolderTag;
    }

    if (!el.ZTITLE) {
      console.warn("No title in", el.ZTEXT);
    }

    return {
      content: el.ZTEXT,
      title: el.ZTITLE,
      tags: [...el.ZTEXT.matchAll(regTags)].map((el) => el[1]),
      id: el.Z_PK,
      folder,
    };
  });
  return allNotes;
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
    "SELECT Z_PK, ZTEXT, ZTITLE FROM `ZSFNOTE` WHERE `ZTRASHED` LIKE '0' AND `ZARCHIVED` LIKE '0'",
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
