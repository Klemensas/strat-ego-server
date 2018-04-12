import { World } from '../world/world';
import { knexDb } from '../../sqldb';

export class TownGrowth {
    public townGrowthInterval: number;
    public townLastGrowth: number;

    public async readGrowth(worldName) {
        try {
            const townGrowth = await World.query(knexDb.world)
            .select('townGrowthInterval','townLastGrowth').findById(worldName);
            this.townGrowthInterval = townGrowth.townGrowthInterval ;
            this.townLastGrowth = townGrowth.townLastGrowth ;
            this.checkGrowth()
           
        }
        
    }
    public checkGrowth () {
        this.townGrowthInterval
    }
}
