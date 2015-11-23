import moment from 'moment'
import passport from 'passport'
import {logout, sendError} from '../lib'

export default function configureRoutes(options={}) {
  const app = options.app
  const User = options.User
  if (!app) throw new Error(`[fl-auth] Missing app from configureRoutes, got ${options}`)

  // login via ajax
  app.post(options.paths.login, (req, res, next) => {

    passport.authenticate('password', (err, user, info) => {
      if (err) return sendError(res, err)
      if (!user) return res.status(401).json({error: 'Incorrect username or password'})

      req.login(user, {}, err => {
        if (err) return sendError(res, err)

        const {access_token} = info
        return res.json({
          access_token,
          user: {
            id: req.user.id,
            email: req.user.get('email'),
          },
        })
      })
    })(req, res, next)
  })

  // register via ajax
  app.post(options.paths.register, (req, res, next) => {

    passport.authenticate('register', (err, user, info) => {
      if (err) return sendError(res, err)
      if (!user) return res.status(402).json({error: info})

      req.login(user, {}, err => {
        if (err) return sendError(res, err)

        const {access_token} = info
        return res.json({
          access_token,
          user: {
            id: user.id,
            email: user.get('email'),
          },
        })
      })
    })(req, res, next)
  })

  // perform password reset
  app.post(options.paths.reset, (req, res, next) => {

    passport.authenticate('reset', (err, user, info) => {
      if (err) return sendError(res, err)
      if (!user) return res.status(402).json({error: info})

      req.login(user, {}, err => {
        if (err) return sendError(res, err)

        const {access_token} = info
        return res.json({
          access_token,
          user: {
            id: user.id,
            email: user.get('email'),
          },
        })
      })
    })(req, res, next)
  })

  // request a reset token to be emailed to a user
  app.post(options.paths.reset_request, (req, res) => {
    const email = req.body.email
    if (!email) return res.status(400).send({error: 'No email provided'})

    User.findOne({email}, (err, user) => {
      if (err) return sendError(res, err)
      if (!user) return res.status(402).json({error: 'User not found'})

      User.createResetToken((err, reset_token) => {
        if (err) return sendError(res, err)

        user.save({reset_token, reset_token_created_at: moment.utc().toDate()}, (err) => {
          if (err) return sendError(res, err)

          options.sendResetEmail(user, (err) => {
            if (err) return sendError(res, err)
            res.status(200).send({})
          })
        })
      })
    })
  })

  // logout
  app.all('/logout', (req, res) => {
    logout(req, () => res.redirect('/'))
  })

  if (options.facebook) {
    // Redirect the user to Facebook for authentication.  When complete,
    // Facebook will redirect the user back to the application at options.paths.facebook_callback
    app.get(options.facebook.paths.redirect, passport.authenticate('facebook', {scope: options.facebook.scope}))

    // Facebook will redirect the user to this URL after approval.  Finish the
    // authentication process by attempting to obtain an access token.  If
    // access was granted, the user will be logged in.  Otherwise,
    // authentication has failed.
    app.get(options.facebook.paths.callback, passport.authenticate('facebook', {successRedirect: '/', failureRedirect: options.paths.login}))
  }

}