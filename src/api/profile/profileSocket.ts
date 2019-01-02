import { UserSocket } from '../../config/socket';
import { ProfileService } from './profileService';

export class ProfileSocket {
  static async onConnect(socket: UserSocket) {
    socket.on('profile:loadPlayers', (payload: number[]) => this.loadPlayerProfiles(socket, payload));
    socket.on('profile:loadTowns', (payload: number[]) => this.loadTownProfiles(socket, payload));
    socket.on('profile:loadAlliances', (payload: number[]) => this.loadAllianceProfiles(socket, payload));
  }

  static async loadPlayerProfiles(socket: UserSocket, payload: number[] = []) {
    try {
      const profiles = await ProfileService.getPlayerProfile(payload);
      socket.emit('profile:loadPlayersSuccess', profiles);
    } catch (err) {
      socket.handleError(err, 'profiles', 'profile:loadPlayersFail', payload);
    }
  }

  static async loadTownProfiles(socket: UserSocket, payload: number[] = []) {
    try {
      const profiles = await ProfileService.getTownProfile(payload);
      socket.emit('profile:loadTownsSuccess', profiles);
    } catch (err) {
      socket.handleError(err, 'profiles', 'profile:loadTownsFail', payload);
    }
  }

  static async loadAllianceProfiles(socket: UserSocket, payload: number[] = []) {
    try {
      const profiles = await ProfileService.getAllianceProfile(payload);
      socket.emit('profile:loadAlliancesSuccess', profiles);
    } catch (err) {
      socket.handleError(err, 'profiles', 'profile:loadAlliancesFail', payload);
    }
  }
}
