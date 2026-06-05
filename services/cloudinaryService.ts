// services/cloudinaryService.ts
export const uploadToCloudinary = async (imageUri: string): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'upload.jpg',
    } as any);
    formData.append('upload_preset', 'vedcivil');
    formData.append('api_key', '152634273923857');
    formData.append('timestamp', (Date.now() / 1000).toString());

    const response = await fetch('https://api.cloudinary.com/v1_1/dx8gqgdtc/image/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // 'Content-Type': 'multipart/form-data' should NOT be set manually
        // fetch will set it with the correct boundary for FormData
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Cloudinary upload failed:', data);
      throw new Error(data.error?.message || 'Upload failed');
    }

    console.log('Cloudinary upload successful:', data.secure_url);
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};

export const uploadMultipleToCloudinary = async (imageUris: string[]): Promise<string[]> => {
  try {
    if (!imageUris || imageUris.length === 0) return [];

    console.log(`Uploading ${imageUris.length} images to Cloudinary...`);

    const uploadPromises = imageUris.map(uri => uploadToCloudinary(uri));
    const uploadedUrls = await Promise.all(uploadPromises);

    console.log(`Successfully uploaded ${uploadedUrls.length} images`);
    return uploadedUrls;
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    throw error;
  }
};