export const promise = (targetFunc: any, ...args) => {
  return new Promise<any>((resolve, reject): Promise<any> => {
    return targetFunc(...args, (error: any, result: any) => error ? reject(error) : resolve(result));
  });
};
