import { describe, it, expect } from "vitest";
import {
  isValidCredentialProvider,
  validateCredentialName,
  validateAwsCredentials,
  validateGcpCredentials,
  validateCredentials,
  validateRegion,
  maskCredentialHint,
  isValidUuid,
} from "@/lib/vault/credentials";

// ---------------------------------------------------------------------------
// isValidCredentialProvider
// ---------------------------------------------------------------------------

describe("isValidCredentialProvider", () => {
  it("accepts aws", () => expect(isValidCredentialProvider("aws")).toBe(true));
  it("accepts gcp", () => expect(isValidCredentialProvider("gcp")).toBe(true));
  it("rejects azure", () => expect(isValidCredentialProvider("azure")).toBe(false));
  it("rejects empty string", () => expect(isValidCredentialProvider("")).toBe(false));
  it("rejects uppercase", () => expect(isValidCredentialProvider("AWS")).toBe(false));
});

// ---------------------------------------------------------------------------
// isValidUuid
// ---------------------------------------------------------------------------

describe("isValidUuid", () => {
  it("accepts valid uuid", () =>
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true));
  it("rejects non-uuid", () => expect(isValidUuid("not-a-uuid")).toBe(false));
  it("rejects empty", () => expect(isValidUuid("")).toBe(false));
});

// ---------------------------------------------------------------------------
// validateCredentialName
// ---------------------------------------------------------------------------

describe("validateCredentialName", () => {
  it("accepts normal name", () =>
    expect(validateCredentialName("Production")).toBeNull());

  it("accepts name with spaces and hyphens", () =>
    expect(validateCredentialName("My AWS Staging-2")).toBeNull());

  it("accepts name with underscores", () =>
    expect(validateCredentialName("prod_account")).toBeNull());

  it("accepts single alphanumeric character", () =>
    expect(validateCredentialName("A")).toBeNull());

  it("rejects empty string", () =>
    expect(validateCredentialName("")).toMatch(/required/));

  it("rejects whitespace only", () =>
    expect(validateCredentialName("   ")).toMatch(/required/));

  it("rejects name over 50 characters", () => {
    const long = "a".repeat(51);
    expect(validateCredentialName(long)).toMatch(/50/);
  });

  it("trims whitespace before validating", () =>
    expect(validateCredentialName(" Production ")).toBeNull());

  it("rejects name with special characters", () =>
    expect(validateCredentialName("Prod@ction!")).toMatch(/start and end|letters/));
});

// ---------------------------------------------------------------------------
// validateAwsCredentials
// ---------------------------------------------------------------------------

const validAwsCreds = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

describe("validateAwsCredentials", () => {
  it("accepts valid AWS credentials", () =>
    expect(validateAwsCredentials(validAwsCreds)).toBeNull());

  it("accepts ASIA prefix (temporary credentials)", () =>
    expect(
      validateAwsCredentials({
        ...validAwsCreds,
        accessKeyId: "ASIA1234567890ABCDEF",
      }),
    ).toBeNull());

  it("rejects null", () =>
    expect(validateAwsCredentials(null)).toMatch(/object/));

  it("rejects non-object", () =>
    expect(validateAwsCredentials("string")).toMatch(/object/));

  it("rejects missing accessKeyId", () =>
    expect(
      validateAwsCredentials({ secretAccessKey: validAwsCreds.secretAccessKey }),
    ).toMatch(/Access Key ID/));

  it("rejects missing secretAccessKey", () =>
    expect(
      validateAwsCredentials({ accessKeyId: validAwsCreds.accessKeyId }),
    ).toMatch(/Secret Access Key/));

  it("rejects accessKeyId with wrong prefix", () =>
    expect(
      validateAwsCredentials({
        ...validAwsCreds,
        accessKeyId: "ABCD1234567890ABCDEF",
      }),
    ).toMatch(/AKIA or ASIA/));

  it("rejects accessKeyId with wrong length (too short)", () =>
    expect(
      validateAwsCredentials({ ...validAwsCreds, accessKeyId: "AKIA1234" }),
    ).toMatch(/20/));

  it("rejects accessKeyId with wrong length (too long)", () =>
    expect(
      validateAwsCredentials({
        ...validAwsCreds,
        accessKeyId: "AKIA12345678901234567",
      }),
    ).toMatch(/20/));

  it("rejects secretAccessKey with wrong length", () =>
    expect(
      validateAwsCredentials({ ...validAwsCreds, secretAccessKey: "short" }),
    ).toMatch(/40/));

  it("rejects secretAccessKey with invalid characters", () =>
    expect(
      validateAwsCredentials({
        ...validAwsCreds,
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCY!XAMPLEKE",
      }),
    ).toMatch(/40/));
});

// ---------------------------------------------------------------------------
// validateGcpCredentials
// ---------------------------------------------------------------------------

const validGcpSaJson = JSON.stringify({
  type: "service_account",
  project_id: "my-project-123",
  private_key_id: "key-id-abc",
  private_key: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n",
  client_email: "sa@my-project-123.iam.gserviceaccount.com",
  client_id: "123456789",
});

describe("validateGcpCredentials", () => {
  it("accepts valid GCP credentials", () =>
    expect(validateGcpCredentials({ serviceAccountJson: validGcpSaJson })).toBeNull());

  it("rejects null", () =>
    expect(validateGcpCredentials(null)).toMatch(/object/));

  it("rejects missing serviceAccountJson", () =>
    expect(validateGcpCredentials({})).toMatch(/Service Account JSON is required/));

  it("rejects non-string serviceAccountJson", () =>
    expect(validateGcpCredentials({ serviceAccountJson: 123 })).toMatch(/required/));

  it("rejects invalid JSON", () =>
    expect(
      validateGcpCredentials({ serviceAccountJson: "not json" }),
    ).toMatch(/not valid JSON/));

  it("rejects JSON array", () =>
    expect(
      validateGcpCredentials({ serviceAccountJson: "[]" }),
    ).toMatch(/JSON object/));

  it("rejects wrong type field", () => {
    const sa = JSON.parse(validGcpSaJson);
    sa.type = "authorized_user";
    expect(
      validateGcpCredentials({ serviceAccountJson: JSON.stringify(sa) }),
    ).toMatch(/service_account/);
  });

  for (const field of [
    "project_id",
    "private_key_id",
    "private_key",
    "client_email",
    "client_id",
  ]) {
    it(`rejects missing ${field}`, () => {
      const sa = JSON.parse(validGcpSaJson);
      delete sa[field];
      expect(
        validateGcpCredentials({ serviceAccountJson: JSON.stringify(sa) }),
      ).toMatch(new RegExp(field));
    });
  }

  it("rejects oversized JSON (>10KB)", () => {
    const oversized = "x".repeat(10_241);
    expect(
      validateGcpCredentials({ serviceAccountJson: oversized }),
    ).toMatch(/10 KB/);
  });
});

// ---------------------------------------------------------------------------
// validateCredentials (dispatcher)
// ---------------------------------------------------------------------------

describe("validateCredentials", () => {
  it("dispatches to AWS validator", () =>
    expect(validateCredentials("aws", validAwsCreds)).toBeNull());

  it("dispatches to GCP validator", () =>
    expect(
      validateCredentials("gcp", { serviceAccountJson: validGcpSaJson }),
    ).toBeNull());

  it("returns error for invalid AWS creds via dispatcher", () =>
    expect(validateCredentials("aws", {})).toBeTruthy());

  it("returns error for invalid GCP creds via dispatcher", () =>
    expect(validateCredentials("gcp", {})).toBeTruthy());
});

// ---------------------------------------------------------------------------
// validateRegion
// ---------------------------------------------------------------------------

describe("validateRegion", () => {
  it("accepts valid AWS region us-east-1", () =>
    expect(validateRegion("aws", "us-east-1")).toBeNull());

  it("accepts valid AWS region ap-southeast-1", () =>
    expect(validateRegion("aws", "ap-southeast-1")).toBeNull());

  it("accepts valid AWS region eu-west-2", () =>
    expect(validateRegion("aws", "eu-west-2")).toBeNull());

  it("rejects invalid AWS region (no hyphens)", () =>
    expect(validateRegion("aws", "useast1")).toMatch(/us-east-1/));

  it("rejects uppercase AWS region", () =>
    expect(validateRegion("aws", "US-EAST-1")).toMatch(/us-east-1/));

  it("accepts valid GCP region us-central1", () =>
    expect(validateRegion("gcp", "us-central1")).toBeNull());

  it("accepts valid GCP region europe-west1", () =>
    expect(validateRegion("gcp", "europe-west1")).toBeNull());

  it("accepts valid GCP region asia-southeast1", () =>
    expect(validateRegion("gcp", "asia-southeast1")).toBeNull());

  it("rejects invalid GCP region (hyphen before number)", () =>
    expect(validateRegion("gcp", "us-central-1")).toMatch(/us-central1/));

  it("rejects uppercase GCP region", () =>
    expect(validateRegion("gcp", "US-CENTRAL1")).toMatch(/us-central1/));

  it("rejects empty region", () =>
    expect(validateRegion("aws", "")).toMatch(/required/));
});

// ---------------------------------------------------------------------------
// maskCredentialHint
// ---------------------------------------------------------------------------

describe("maskCredentialHint", () => {
  it("masks AWS accessKeyId (first 4 + last 4)", () => {
    const json = JSON.stringify({
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "secret",
    });
    expect(maskCredentialHint("aws", json)).toBe("AKIA...MPLE");
  });

  it("returns project id for GCP", () => {
    const json = JSON.stringify({ serviceAccountJson: validGcpSaJson });
    expect(maskCredentialHint("gcp", json)).toBe("project: my-project-123");
  });

  it("returns fallback for malformed AWS JSON", () =>
    expect(maskCredentialHint("aws", "not json")).toBe("(unable to read)"));

  it("returns fallback for AWS with short accessKeyId", () => {
    const json = JSON.stringify({ accessKeyId: "AK", secretAccessKey: "s" });
    expect(maskCredentialHint("aws", json)).toBe("(unable to read)");
  });

  it("returns fallback for GCP with missing serviceAccountJson", () => {
    const json = JSON.stringify({ something: "else" });
    expect(maskCredentialHint("gcp", json)).toBe("(unable to read)");
  });

  it("returns fallback for GCP with invalid inner JSON", () => {
    const json = JSON.stringify({ serviceAccountJson: "not json" });
    expect(maskCredentialHint("gcp", json)).toBe("(unable to read)");
  });
});
