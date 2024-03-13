export type BearNote = {
  ZTEXT: string;
  Z_PK: number;
  ZTITLE: string;
  ZCREATIONDATE: number;
  ZMODIFICATIONDATE: number;
};

export type BearAsset = {
  ZUNIQUEIDENTIFIER: string;
  ZNOTE: number;
  ZFILENAME: string;
};

export type MappedNote = {
  content: string;
  title: string;
  tags: string[];
  id: number;
  folder: string;
  date: {
    created: Date;
    modified: Date;
  };
};

export type Options = {
  quartz: {
    indexTitle: string;
    onlyWritePublishedAssets: boolean;
  };
  dryRun: boolean;
  exportDir: {
    notes: string;
    images: string;
  };
  tags: {
    exclude: string[];
    treatAsFolders: string[];
  };
};
