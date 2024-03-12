import path from "path";

export default function getOptions() {
  return {
    quartz: {
      indexTitle: "Garden index",
    },
    exportDir: {
      notes: path.join("repos", "quartz", "content"),
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
