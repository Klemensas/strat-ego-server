import { Sequelize } from 'sequelize';


export const connection = new Sequelize('postgres://stratego:supasecretpassword@localhost:5432/stratego');
