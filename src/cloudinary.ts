import * as cloudinary from 'cloudinary';

import * as config from '../src/config/environment';

cloudinary.config({
  cloud_name: config.cloudinary.name,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export const isCloudinaryImage = (avatarUrl: string) => {
  return avatarUrl.indexOf(`https://res.cloudinary.com/${config.cloudinary.name}/`) === 0;
};

export const cloudinaryDelete = (avatarUrl: string) => {
  const avatarString = avatarUrl.split('/');
  const folder = avatarString[avatarString.length - 2];
  const id = avatarString[avatarString.length - 1].split('.')[0];
  const publicId = `${folder}/${id}`;
  return new Promise((resolve, reject) => {
    cloudinary.v2.uploader.destroy(publicId, (error, result) => {
      if (error) { return reject(error); }
      resolve(result);
    });
  });
}
