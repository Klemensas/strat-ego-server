const worlds = {};

export const addWorld = (name, data) => {
  worlds[name] = data;
};

export const activeWorlds = worlds;
