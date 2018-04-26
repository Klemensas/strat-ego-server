import { transaction } from 'objection';

import { TownSocket } from './town.socket';
import { TownSupport } from './townSupport';

fdescribe('cancelSupport', () => {
  fit('should rollback transaction and call socket handler', async () => {
    const socket = {
      handleError: jest.fn().mockImplementation(() => null),
    } as any;
    const error = 'dead';
    const type = 'origin';
    const payload = 1;
    const transactionSpy = jest.fn();
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => ({ rollback: transactionSpy }));

    jest.spyOn(TownSupport, 'query').mockImplementationOnce(() => { throw error; });

    await TownSocket.cancelSupport(socket, 1, type);
    expect(transactionSpy).toHaveBeenCalled();
    expect(socket.handleError).toHaveBeenCalledWith(error, 'support', `town:recallSupportFail`, payload);
  });
});
