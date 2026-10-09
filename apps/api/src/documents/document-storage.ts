export type StoredDocument = {
  storageProvider: 'LOCAL';
  storageKey: string;
};

export abstract class DocumentStorage {
  abstract put(bytes: Buffer): Promise<StoredDocument>;
  abstract putFile(sourcePath: string): Promise<StoredDocument>;
  abstract read(storageKey: string): Promise<Buffer>;
  abstract remove(storageKey: string): Promise<void>;
}
