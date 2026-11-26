import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { roomError } from "./geometry";
import { projectSchema, type Project } from "./schema";

export const STORAGE_KEY = "maquette.room.v1";
export function validateProject(data: unknown): Project {
  const project = projectSchema.parse(data);
  const error = roomError(project.room);
  if (error) throw new Error(error);
  return project;
}
export function encodeProject(project: Project) {
  const encoded = compressToEncodedURIComponent(
    JSON.stringify(validateProject(project)),
  );
  if (encoded.length > 24000)
    throw new Error(
      "This room is too large for a share link. Export the room file instead.",
    );
  return encoded;
}
export function decodeProject(encoded: string) {
  if (!encoded || encoded.length > 24000)
    throw new Error("This share link is incomplete or too large.");
  const text = decompressFromEncodedURIComponent(encoded);
  if (!text || text.length > 100000)
    throw new Error("This share link is invalid.");
  return validateProject(JSON.parse(text));
}
