const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
initializeDBAndServer()

module.exports = app

// Middleware function
const check = (request, response, next) => {
  const authHeader = request.headers['authorization']
  if (authHeader) {
    const jwtToken = authHeader.split(' ')[1]
    if (jwtToken) {
      jwt.verify(jwtToken, 'MY_SECRET_TOKEN', error => {
        if (error) {
          response.status(401).send('Invalid JWT Token')
        } else {
          next()
        }
      })
    } else {
      response.status(401).send('Invalid JWT Token')
    }
  } else {
    response.status(401).send('Invalid JWT Token')
  }
}

// States list
app.get('/states/', check, async (request, response) => {
  const getStatesQuery = `select * from state;`
  const stateList = await db.all(getStatesQuery)
  response.send(
    stateList.map(eachState => {
      return {
        stateId: eachState.state_id,
        stateName: eachState.state_name,
        population: eachState.population,
      }
    }),
  )
})

// Get State
const convertdbUsertoObj = dbObj => {
  return {
    stateId: dbObj.state_id,
    stateName: dbObj.state_name,
    population: dbObj.population,
  }
}

app.get('/states/:stateId/', check, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `select * from state where state_id=${stateId};`
  const stateDetails = await db.get(getStateQuery)
  response.send(convertdbUsertoObj(stateDetails))
})

// Create district
app.post('/districts/', check, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const insertDistrictQuery = `insert into district(district_name,state_id,cases,cured,active,deaths)
  values(
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths}
  );`
  await db.run(insertDistrictQuery)
  response.send('District Successfully Added')
})

// Get district
const convertDistrictdbtoObject = dbObj => {
  return {
    districtId: dbObj.district_id,
    districtName: dbObj.district_name,
    stateId: dbObj.state_id,
    cases: dbObj.cases,
    cured: dbObj.cured,
    active: dbObj.active,
    deaths: dbObj.deaths,
  }
}

app.get('/districts/:districtId/', check, async (request, response) => {
  const {districtId} = request.params
  const getDistrictQuery = `select * from district where district_id=${districtId};`
  const districtDetails = await db.get(getDistrictQuery)
  response.send(convertDistrictdbtoObject(districtDetails))
})

// Delete district
app.delete('/districts/:districtId/', check, async (request, response) => {
  const {districtId} = request.params
  const deleteDistrictQuery = `delete from district where district_id=${districtId};`
  await db.run(deleteDistrictQuery)
  response.send('District Removed')
})

// Update district details
app.put('/districts/:districtId/', check, async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const updateQuery = `update district set 
  district_name='${districtName}',
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths}
  where district_id=${districtId};`
  await db.run(updateQuery)
  response.send('District Details Updated')
})

// Get total cases
const convertTo = stats => {
  return {
    totalCases: stats.totalCases,
    totalCured: stats.totalCured,
    totalActive: stats.totalActive,
    totalDeaths: stats.totalDeaths,
  }
}

app.get('/states/:stateId/stats/', check, async (request, response) => {
  const {stateId} = request.params
  const getDetails = `select 
  SUM(cases) as totalCases,
  SUM(cured) as totalCured,
  SUM(active) as totalActive,
  SUM(deaths) as totalDeaths
  from district where state_id=${stateId};`
  const stats = await db.get(getDetails)
  console.log(stats)
  response.send(convertTo(stats))
})

// Login User
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `select * from user where username='${username}';`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser) {
    const isPasswordCorrect = await bcrypt.compare(password, dbUser.password)
    if (isPasswordCorrect) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400).send('Invalid password')
    }
  } else {
    response.status(400).send('Invalid user')
  }
})

module.exports = app
