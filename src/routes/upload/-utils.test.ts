import { describe, expect, it } from "vitest";
import { uploadCopy } from "../../copy/upload";
import { formatPublishError } from "./-utils";

describe("upload error formatting", () => {
  it("maps invalid documentation links to actionable Chinese guidance", () => {
    expect(
      formatPublishError({
        data: {
          code: "invalid_documentation_link",
          error: "documentationLinks[0].url must use http or https",
        },
      }),
    ).toBe(uploadCopy.status.invalidDocumentationLink);
  });
});
