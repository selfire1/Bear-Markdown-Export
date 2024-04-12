import { MappedNote } from "./types";
import dayjs from "dayjs";
import path from "path";
import os from "os";
import getOptions from "./options";

class DynamicFile {
  writePath: string;
  content: string;
  constructor(
    {
      filter,
      templater,
      sorter,
      filePath,
      permalink,
      body,
    }: {
      filter: (notes: MappedNote[]) => MappedNote[];
      sorter: (notes: MappedNote[]) => MappedNote[];
      templater: (notes: MappedNote[]) => string;

      filePath: string;
      permalink: string;
      body: string;
    },
    notes: MappedNote[],
  ) {
    const content = `---\npublish: true\npermalink: ${permalink}\n---\n\n${body}`;
    this.content = content + "\n\n" + templater(sorter(filter(notes)));
    this.writePath = path.join(
      os.homedir(),
      getOptions().exportDir.notes,
      `${filePath}.md`,
    );
  }
  async writeFile() {
    return await Bun.write(this.writePath, this.content);
  }
}

const BOOK_FOLDER = "30 External/31 Books";

const getDateString = (el: string, format = "MMM D, YYYY"): string => {
  try {
    const date = new Date(el).toLocaleString("en-US", {
      timeZone: "Australia/Brisbane",
    });
    return dayjs(date).format(format);
  } catch (e) {
    return "";
  }
};

export const getDynamicFiles = (notes: MappedNote[]) => {
  const booksRead = new DynamicFile(
    {
      filter: (notes: MappedNote[]) => {
        return notes.filter((el) =>
          [
            el.folder.startsWith(BOOK_FOLDER),
            el.frontmatter.publish,
            el.frontmatter?.read,
          ].every(Boolean),
        );
      },
      sorter: (notes: MappedNote[]) => {
        return notes.sort((a, b) => {
          return (
            new Date(b.frontmatter?.read).valueOf() -
            new Date(a.frontmatter?.read).valueOf()
          );
        });
      },
      templater: (notes: MappedNote[]) => {
        const headers = "| Cover | Title | Read |";
        const separator =
          "| :--------------- | :------------------: | :----------------- |";
        const rows = notes.map((el) => {
          return (
            "| " +
            [
              el.frontmatter?.thumbnail
                ? `![thumb\\|80](${el.frontmatter?.thumbnail})`
                : "",
              "[[" + el.title + "]]",
              getDateString(el.frontmatter?.read),
            ].join(" | ") +
            " |"
          );
        });
        const tableBody = [headers, separator, ...rows].join("\n");
        return tableBody;
      },
      filePath: "60 Outputs/Books Read (Auto-Updating)",
      permalink: "dn7aBKbWWW931tT8DQSvRu",
      body: "# Books Read (Auto-Updating)",
    },
    notes,
  );

  const booksReading = new DynamicFile(
    {
      filter: (notes: MappedNote[]) => {
        const filtered = notes.filter((el) =>
          [
            el.folder.startsWith(BOOK_FOLDER),
            el.frontmatter.publish,
            el.content.includes("#book/currently-reading"),
          ].every(Boolean),
        );
        return filtered;
      },
      sorter: (notes: MappedNote[]) => {
        return notes.sort((a, b) => {
          return (
            new Date(b.frontmatter?.started).valueOf() -
            new Date(a.frontmatter?.started).valueOf()
          );
        });
      },
      templater: (notes: MappedNote[]) => {
        const headers = "| Cover | Title |";
        const separator = "| :--------------- | :------------------: |";
        const rows = notes.map((el) => {
          return (
            "| " +
            [
              el.frontmatter?.thumbnail
                ? `![thumb\\|60](${el.frontmatter?.thumbnail})`
                : "",
              "[[" + el.title + "]]",
            ].join(" | ") +
            " |"
          );
        });
        const rowIfEmpty = "| | |";
        const tableBody = [
          headers,
          separator,
          ...(rows?.length ? rows : [rowIfEmpty]),
        ].join("\n");
        return tableBody;
      },
      filePath: "60 Outputs/Currently Reading (Auto-Updating)",
      permalink: "rEcyrvGqKjvf4D7dB3ketR",
      body: "# Currently Reading (Auto-Updating)",
    },
    notes,
  );

  const booksRecentlyRead = new DynamicFile(
    {
      templater: (notes: MappedNote[]) => {
        const headers = "| Cover | Title | Read |";
        const separator =
          "| :--------------- | :------------------ | :------------------: |";
        const rows = notes.map((el) => {
          return (
            "| " +
            [
              el.frontmatter?.thumbnail
                ? `![thumb\\|50](${el.frontmatter?.thumbnail})`
                : "",
              "[[" + el.title + "]]",
              getDateString(el.frontmatter?.read),
            ].join(" | ") +
            " |"
          );
        });
        const rowIfEmpty = "| | |";
        const tableBody = [
          headers,
          separator,
          ...(rows?.length ? rows : [rowIfEmpty]),
        ].join("\n");
        return tableBody;
      },
      filter: (notes: MappedNote[]) => {
        const filtered = notes.filter((el) =>
          [
            el.folder.startsWith(BOOK_FOLDER),
            el.frontmatter.publish,
            el.frontmatter?.read,
          ].every(Boolean),
        );
        return filtered;
      },
      sorter: (notes: MappedNote[]) => {
        return notes
          .sort((a, b) => {
            return (
              new Date(b.frontmatter?.read).valueOf() -
              new Date(a.frontmatter?.read).valueOf()
            );
          })
          .slice(0, 5);
      },
      filePath: "60 Outputs/Recently read",
      permalink: "uktgERNWudD3eZ4fcwdUry",
      body: "# Recently read",
    },
    notes,
  );

  const notesRecentlyEdited = new DynamicFile(
    {
      templater: (notes: MappedNote[]) => {
        const headers = "| Note | Modified |";
        const separator = "| :--------------- | :------------------: |";
        const rows = notes.map((el) => {
          return (
            "| " +
            [
              "[[" + el.title + "]]",
              getDateString(el.date.modified.toString(), "MMM D, YYYY, h:mm A"),
            ].join(" | ") +
            " |"
          );
        });
        const tableBody = [headers, separator, ...rows].join("\n");
        return tableBody;
      },
      filter: (notes: MappedNote[]) => {
        const filtered = notes.filter((el) =>
          [el.frontmatter.publish].every(Boolean),
        );
        return filtered;
      },
      sorter: (notes: MappedNote[]) => {
        return notes
          .sort((a, b) => {
            return (
              new Date(b.date.modified).valueOf() -
              new Date(a.date.modified).valueOf()
            );
          })
          .slice(0, 7);
      },
      filePath: "60 Outputs/Recently edited",
      permalink: "oskqEgv91u4hJnQBUfx2u4",
      body: "# Recently edited",
    },
    notes,
  );

  const notesRecentlyCreated = new DynamicFile(
    {
      templater: (notes: MappedNote[]) => {
        const headers = "| Note | Added |";
        const separator = "| :--------------- | :------------------: |";
        const rows = notes.map((el) => {
          return (
            "| " +
            [
              "[[" + el.title + "]]",
              getDateString(el.date.created.toString(), "MMM D, YYYY, h:mm A"),
            ].join(" | ") +
            " |"
          );
        });
        const tableBody = [headers, separator, ...rows].join("\n");
        return tableBody;
      },
      filter: (notes: MappedNote[]) => {
        const filtered = notes.filter((el) =>
          [el.frontmatter.publish].every(Boolean),
        );
        return filtered;
      },
      sorter: (notes: MappedNote[]) => {
        return notes
          .sort((a, b) => {
            return (
              new Date(b.date.created).valueOf() -
              new Date(a.date.created).valueOf()
            );
          })
          .slice(0, 7);
      },
      filePath: "60 Outputs/Recent new files",
      permalink: "4domq73qZGB6ySfhcoZXhr",
      body: "# Recent new files",
    },
    notes,
  );

  return [
    booksRead,
    booksReading,
    booksRecentlyRead,
    notesRecentlyEdited,
    notesRecentlyCreated,
  ];
};
