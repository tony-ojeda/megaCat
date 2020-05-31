const boom = require('@hapi/boom')
const cryptoRandomString = require('crypto-random-string')
const bcrypt = require('bcrypt')
const auth = require('../../../auth/')
const { generateUsername } = require('../../../utils/userUtils')
const userCtrl = require('../user/index')
const emailCtrl = require('../email/index')
const authRolesCtrl = require('../auth_roles/index')

const TABLE = 'auths'
const saltRounds = 10

module.exports = (store) => {
  async function get (q) {
    if (!q) throw boom.badData()
    const user = await store.query(TABLE, q, null, [
      {
        as: 'roles',
        model: store.model('role'),
        attributes: ['id', 'name'],
        through: {
          attributes: []
        }
      }
    ])

    return user[0]
  }

  async function addUser (userData) {
    try {
      if (!userData) throw new Error('no data')

      const { idNumber, firstName, lastName, email, contactNumber, address, roleId } = userData

      let username = generateUsername(idNumber, firstName, lastName)
      const password = cryptoRandomString({ length: 16, type: 'base64' })

      const hasUsername = await store.query(TABLE, { username })

      if (hasUsername.length > 0) {
        const randomNumber = () => Math.ceil(Math.random() * 9)
        let newUsername = `${username.slice(0, -2)}${randomNumber()}${randomNumber()}`
        if (username === newUsername) {
          newUsername = `${username.slice(0, -2)}${randomNumber()}${randomNumber()}`
        } else {
          username = `${username.slice(0, -2)}${randomNumber()}${randomNumber()}`
        }
      }

      const authData = {
        username,
        password: await bcrypt.hash(password, saltRounds)
      }

      const user = await userCtrl.insert({
        idNumber,
        firstName,
        lastName,
        email,
        contactNumber,
        address,
        username
      })

      await authRolesCtrl.insert(user.id, roleId)

      await store.insert(TABLE, { ...authData, id: user.id })
      // ToDo: Add role
      const emailInfo = {
        ...JSON.parse(JSON.stringify(user)),
        password: password
      }
      await emailCtrl.sendNewUser(emailInfo)

      return true
    } catch (error) {
      throw boom.badRequest()
    }
  }
  // ToDo: Add Role data
  async function login (User) {
    try {
      if (!User) {
        throw boom.unauthorized()
      }

      const user = {
        id: User.id,
        idNumber: User.idNumber,
        username: User.username,
        roles: User.roles
      }

      const token = await auth.sign({ ...user })

      return {
        token,
        user
      }
    } catch (error) {
      throw boom.unauthorized()
    }
  }

  return {
    login,
    get,
    addUser
  }
}
