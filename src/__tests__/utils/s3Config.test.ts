import { S3 } from "aws-sdk";
import { uploadFile } from "../../utils/s3Config"; // Adjust path as needed
import { getCachedParameter } from "../../utils/ssmConfig"; // Adjust path as needed

// Mock the S3 and getCachedParameter
jest.mock("aws-sdk", () => {
  const mockUpload = jest.fn();
  return {
    S3: jest.fn(() => ({
      upload: mockUpload,
    })),
    __mockUpload: mockUpload,
  };
});

jest.mock("../../utils/ssmConfig", () => ({
  getCachedParameter: jest.fn(),
}));

const { __mockUpload: mockUpload } = jest.requireMock("aws-sdk");
const mockGetCachedParameter = jest.mocked(getCachedParameter);

describe("uploadFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const bucketName = "mock-bucket";
  const kmsKeyId = "mock-kms-key-id";
  const fileKey = "mock-key";
  const fileBody = Buffer.from("mock-content");
  const contentType = "text/plain";
  const fileLocation = "https://mock-bucket.s3.amazonaws.com/mock-key";

  it("should upload a file to S3 and return its location", async () => {
    // Mock getCachedParameter responses
    mockGetCachedParameter.mockResolvedValueOnce(bucketName); // For bucket name
    mockGetCachedParameter.mockResolvedValueOnce(kmsKeyId); // For KMS key ID

    // Mock S3 upload response
    mockUpload.mockReturnValue({
      promise: jest.fn().mockResolvedValueOnce({
        Location: fileLocation,
      }),
    });

    const result = await uploadFile(fileKey, fileBody, contentType);

    expect(mockGetCachedParameter).toHaveBeenCalledWith("/myapp/s3/bucket-name");
    expect(mockGetCachedParameter).toHaveBeenCalledWith("/myapp/s3/kms-key-id");

    expect(mockUpload).toHaveBeenCalledWith({
      Bucket: bucketName,
      Key: fileKey,
      Body: fileBody,
      ContentType: contentType,
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: kmsKeyId,
    });

    expect(result).toBe(fileLocation);
  });

  it("should throw an error if S3 upload fails", async () => {
    // Mock getCachedParameter responses
    mockGetCachedParameter.mockResolvedValueOnce(bucketName); // For bucket name
    mockGetCachedParameter.mockResolvedValueOnce(kmsKeyId); // For KMS key ID

    // Mock S3 upload error
    mockUpload.mockReturnValue({
      promise: jest.fn().mockRejectedValueOnce(new Error("S3 upload failed")),
    });

    await expect(uploadFile(fileKey, fileBody, contentType)).rejects.toThrow(
      "S3 upload failed"
    );

    expect(mockGetCachedParameter).toHaveBeenCalledWith("/myapp/s3/bucket-name");
    expect(mockGetCachedParameter).toHaveBeenCalledWith("/myapp/s3/kms-key-id");

    expect(mockUpload).toHaveBeenCalledWith({
      Bucket: bucketName,
      Key: fileKey,
      Body: fileBody,
      ContentType: contentType,
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: kmsKeyId,
    });
  });
});
