import { solveLayouts } from "./solver";
import type { Project } from "./schema";

self.onmessage = (event: MessageEvent<Project>) => {
  try {
    self.postMessage({
      layouts: solveLayouts(
        event.data.room,
        event.data.items,
        event.data.brief,
      ),
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Layout calculation failed.",
    });
  }
};
