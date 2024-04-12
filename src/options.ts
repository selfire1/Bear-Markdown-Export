import path from "path";
import { Options } from "./types";

export default function getOptions(): Options {
  return {
    quartz: {
      indexTitle: "Garden index",
      onlyWritePublishedAssets: true, // only write images mentioned in notes that have `publish: true`
    },
    ignoreNotes: ["Publish note to keep tag"],
    dryRun: false,
    exportDir: {
      // notes: path.join("repos", "quartz", "content"),
      notes: path.join("Desktop", "BearExport"),
      images: path.join("00 Meta", "02 Attachments"),
    },
    tags: {
      exclude: ["blog", "draft"],
      treatAsFolders: [
        "00 meta",
        "10 journals",
        "30 external",
        "40 d&d",
        "50 slipbox",
        "60 outputs",
      ],
    },
  };
}
