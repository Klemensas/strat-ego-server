import * as cloudinary from 'cloudinary';

import { isCloudinaryImage, cloudinaryDelete } from './cloudinary';
import * as config from '../src/config/environment';

describe('isCloudinaryImage', () => {
  it('should return true provided the expected string', () => {
    const start = `https://res.cloudinary.com/${config.cloudinary.name}/`;
    isCloudinaryImage(start);
    isCloudinaryImage(start + 123123);
    isCloudinaryImage(start + 'asd/asd/sad/sad/sa');
  });

  it('should return false on non matching string', () => {
    isCloudinaryImage('123');
    isCloudinaryImage(`https://res.cloudinary.com/anything/`);
  });
});

describe('cloudinaryDelete', () => {
  let cloudinarySpy;
  beforeEach(() => {
    cloudinarySpy = jest.spyOn(cloudinary.v2.uploader, 'destroy');
  });

  it('should return a promise', () => {
    cloudinarySpy.mockImplementationOnce(() => null);
    expect(cloudinaryDelete('a') instanceof Promise).toBeTruthy();
  });

  it('should resolve on destroy success', async () => {
    const testResult = 'resolved';
    const testValue = 'string/value';
    cloudinarySpy.mockImplementationOnce((id, func) => func(null, testResult));
    const result = await cloudinaryDelete(testValue);
    expect(result).toEqual(testResult);
    expect(cloudinarySpy).toHaveBeenCalledWith(testValue, expect.anything());
  });

  it('should reject on destroy success', async () => {
    const testError = 'error';
    const testValue = 'string/value';
    cloudinarySpy.mockImplementationOnce((id, func) => func(testError));
    let result;
    try {
      await cloudinaryDelete(testValue);
    } catch (err) {
      result = err;
    }
    expect(result).toEqual(testError);
  });
});
