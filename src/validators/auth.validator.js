import { celebrate, Joi, Segments } from 'celebrate'

export const registerValidator = celebrate({
  [Segments.BODY]: Joi.object().keys({
    username: Joi.string().min(3).max(30).required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().min(2).required(),
  }),
})

export const loginValidator = celebrate({
  [Segments.BODY]: Joi.object().keys({
    username: Joi.string().required(),
    password: Joi.string().required(),
  }),
})

// Refresh token may arrive in cookie OR body — body is optional.
export const refreshValidator = celebrate({
  [Segments.BODY]: Joi.object().keys({
    refreshToken: Joi.string().optional(),
  }),
})
