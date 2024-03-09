export type BearNote = {
  ZTEXT: string;
  Z_PK: number;
  ZTITLE: string;
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
};
