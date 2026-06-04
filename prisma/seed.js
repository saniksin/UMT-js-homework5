// Заповнення БД двома демо-користувачами та оголошеннями (по половині для
// кожного автора). Зручно для перевірки ownership: токеном alice не можна
// редагувати оголошення bob і навпаки.
// Запуск: `npm run db:seed`.

import bcrypt from 'bcrypt'
import prisma from './client.js'

const DEMO_USERS = [
  { username: 'test_alice', name: 'Аліса', password: 'alice-pass-123' },
  { username: 'test_bob', name: 'Боб', password: 'bob-pass-123' },
]

const titles = [
  'Ноутбук ASUS ROG, майже новий',
  'Iphone 14 Pro Max, ідеальний стан',
  'Ремонт компʼютерів вдома',
  'Вакансія: Junior Node.js розробник',
  'Велосипед гірський Trek',
  'Послуги репетитора з англійської',
  'Продам диван, стан хороший',
  'Шукаю няню для дитини 3 роки',
  'PlayStation 5 + 2 геймпади',
  'Дизайн логотипу за 24 години',
  'Робота курʼєром у центрі міста',
  'Пилосос Dyson V11, як новий',
  'Послуги електрика, виклик безкоштовно',
  'Вакансія: контент-менеджер віддалено',
  'Камера Canon EOS R6 + обʼєктив',
  'Продам гітару акустичну Yamaha',
  'Послуги клінінгу квартир та офісів',
  'Шукаю програміста на проєкт фріланс',
  'Скейтборд новий у коробці',
  'Уроки гри на фортепіано',
  'Робота офіціантом у ресторані',
  'Холодильник Bosch, гарантія 6 міс',
  'Майстер-клас з суші',
  'Вакансія: бухгалтер part-time',
  'Курси з веб-розробки за 3 місяці',
]

const contacts = [
  '+380501112233',
  '+380672223344',
  'sale@example.com',
  'hr@company.io',
  '+380939876543',
]

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

const main = async () => {
  // Wipe everything (cascade order).
  await prisma.refreshToken.deleteMany({})
  await prisma.announcement.deleteMany({})
  await prisma.user.deleteMany({})

  const users = []
  for (const u of DEMO_USERS) {
    const hashed = await bcrypt.hash(u.password, 10)
    const user = await prisma.user.create({
      data: { username: u.username, name: u.name, password: hashed },
    })
    users.push(user)
  }

  for (const [idx, title] of titles.entries()) {
    let category = 'other'
    if (/продам|купив|нов/i.test(title)) category = 'sale'
    if (/ремонт|послуги|майстер|клінінг|уроки/i.test(title)) category = 'service'
    if (/вакансія|робота|шукаю/i.test(title)) category = 'job'

    const daysAgo = idx % 12
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    const owner = users[idx % users.length]

    await prisma.announcement.create({
      data: {
        title,
        description:
          title +
          '. Більше деталей за запитом. ' +
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        price: Math.round((Math.random() * 50000 + 100) * 100) / 100,
        category,
        contactInfo: pick(contacts),
        createdAt,
        userId: owner.id,
      },
    })
  }

  const [userCount, totalAnnouncements] = await Promise.all([
    prisma.user.count(),
    prisma.announcement.count(),
  ])
  console.log(
    `Seed complete. Users: ${userCount}, announcements: ${totalAnnouncements}.`,
  )
  console.log('Demo credentials:')
  for (const u of DEMO_USERS) {
    console.log(`  • ${u.username} / ${u.password}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
