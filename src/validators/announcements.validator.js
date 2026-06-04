import { celebrate, Joi, Segments } from 'celebrate'

const VALID_CATEGORIES = ['sale', 'service', 'job', 'other']

export const listAnnouncementsValidator = celebrate({
  [Segments.QUERY]: Joi.object().keys({
    search: Joi.string().allow('').optional(),
    sort: Joi.string().valid('newest', 'oldest').optional(),
    page: Joi.number().integer().greater(0).optional(),
  }),
})

export const idParamValidator = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.number().integer().required(),
  }),
})

export const createAnnouncementValidator = celebrate({
  [Segments.BODY]: Joi.object().keys({
    title: Joi.string().min(5).max(100).required(),
    description: Joi.string().min(10).required(),
    price: Joi.number().greater(0).required(),
    category: Joi.string().valid(...VALID_CATEGORIES).required(),
    contactInfo: Joi.string().min(5).required(),
  }),
})

// Тіло може бути порожнім, коли оновлюється лише фото (воно приходить як
// файл у multipart, а не в body). Вимогу «щось має змінитися» (текст або
// фото) перевіряє контролер updateAnnouncement.
export const updateAnnouncementValidator = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.number().integer().required(),
  }),
  [Segments.BODY]: Joi.object().keys({
    title: Joi.string().min(5).max(100),
    description: Joi.string().min(10),
    price: Joi.number().greater(0),
    category: Joi.string().valid(...VALID_CATEGORIES),
    contactInfo: Joi.string().min(5),
  }),
})
