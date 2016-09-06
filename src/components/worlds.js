const worlds = new Map();

export const addWorld = (name, data) => {
  worlds.set(name, data);
};

export const activeWorlds = worlds;
