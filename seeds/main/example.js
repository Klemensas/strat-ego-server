const speed = process.env.WORLD_SPEED || 1;

exports.seed = (knex, Promise) => knex('User').del()
  .then(() => knex('User').insert([{
      name: 'admin',
      email: 'admin@admin.com',
      password: 'dbgkNbBtNRPKI0Gvnz8bnvCpBipvCSjRHiDbd9y1+ctZN59vmbLHzDF5cNjYL8EjHUJTSE4tWSDpAvWBapvvHw==',
      salt: 'mepyIyafki7lYV/SjUemBg==',
      role: 'admin',
      provider: 'local',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, {
      name: 'test',
      email: 'test@test.com',
      password: 'm0on7YE189BX+w89s5dvPwUX1+C1J9ZT8MrE23gR7RBT5KEolUiSJBOqpXpKMCtzgO1MCIVQojQv1ImGfYa9xQ==',
      salt: 'AzhSjDA2sFinkcPEOY4ZuA==',
      role: 'member',
      provider: 'local',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }])
  )
  .then(() => knex('World').del())
  .then(() => knex('World').insert([{
    name: 'megapolis',
    baseProduction: 5000,
    speed,
    size: 999,
    regionSize: 27,
    fillTime: (90 * 24 * 60 * 60 * 1000),
    fillPercent: 0.8,
    barbPercent: 0.6,
    timeQouta: 0.4,
    generationArea: 9,
    currentRing: 1,
    initialLoyalty: 30,
    loyaltyRegeneration: 1,
    loyaltyReductionRange: [100, 105],
    createdAt: Date.now(),
    updatedAt: Date.now(),
}]))