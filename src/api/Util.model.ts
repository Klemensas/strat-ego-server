export interface Resources {
  wood: number;
  clay: number;
  iron: number;
}

export interface Requirements {
  item: string;
  level: number;
}

export interface Combat {
  attack: number;
  defense: {
    general: number;
    cavalry: number;
    archer: number;
  };
}

export interface TownBuildings {
  [name: string]: {
    level: number;
    queued: number;
  };
}

export interface TownUnits {
  [name: string]: {
    inside: number;
    outside: number;
    queued: number;
  };
}
