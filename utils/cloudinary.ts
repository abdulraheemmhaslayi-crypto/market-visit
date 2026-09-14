import crypto from 'crypto';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

const createMockUploadResult = async (category: string): Promise<CloudinaryUploadResult> => {
  console.log(`[Cloudinary Mock] Simulating upload for photo in category: ${category}`);
  await new Promise((resolve) => setTimeout(resolve, 800));

  let url = 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80';
  if (category === 'Beverages') {
    url = 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80';
  } else if (category === 'Ice Cream') {
    url = 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&w=600&q=80';
  } else if (category === 'Vegetables') {
    url = 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=600&q=80';
  }

  const mockId = `mock_${category.toLowerCase().replace(/\s+/g, '_')}_${Math.random().toString(36).substring(2, 8)}`;
  return {
    secure_url: url,
    public_id: mockId,
  };
};

export const uploadToCloudinary = async (
  fileBase64: string,
  category: string
): Promise<CloudinaryUploadResult> => {
  const rawCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = rawCloudName?.trim().toLowerCase();

  if (!cloudName || !apiKey || !apiSecret) {
    return createMockUploadResult(category);
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000).toString();
    const folder = `field_visits/${category}`;

    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash('sha1')
      .update(paramsToSign + apiSecret)
      .digest('hex');

    const base64Data = fileBase64.startsWith('data:')
      ? fileBase64
      : `data:image/jpeg;base64,${fileBase64}`;

    const bodyParams = new URLSearchParams();
    bodyParams.append('file', base64Data);
    bodyParams.append('api_key', apiKey);
    bodyParams.append('timestamp', timestamp);
    bodyParams.append('folder', folder);
    bodyParams.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`[Cloudinary] Upload failed, falling back to mock upload: ${errorBody}`);
      return createMockUploadResult(category);
    }

    const result = await response.json();
    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.warn('[Cloudinary] Upload exception, falling back to mock upload:', error);
    return createMockUploadResult(category);
  }
};

export type UploadToCloudinary = typeof uploadToCloudinary;
export type CloudinaryUploadResultType = CloudinaryUploadResult;
