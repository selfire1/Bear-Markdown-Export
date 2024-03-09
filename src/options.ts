import path from "path";

export default function getOptions() {
  return {
    exportDir: {
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
