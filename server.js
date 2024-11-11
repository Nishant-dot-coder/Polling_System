require('dotenv').config();


const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/User');
const Poll = require('./models/Poll');
const flash = require('connect-flash');


const app = express();

// Use flash for error messages
app.use(flash());

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Set up session management
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport local strategy for login
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = await User.findOne({ username });
      if (!user) return done(null, false, { message: 'Incorrect username' });
      
      const isMatch = await user.comparePassword(password);
      if (!isMatch) return done(null, false, { message: 'Incorrect password' });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// Serialize and deserialize user to store/retrieve from session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Connect to MongoDB (local database)
mongoose.connect(process.env.DATABASE).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Routes

// Home route (display all polls)
app.get('/', async (req, res) => {
  const polls = await Poll.find();
  res.render('index', { polls, user: req.user });
});

// Create Poll route (must be logged in)
app.get('/create', isAuthenticated, (req, res) => {
  res.render('create');
});

// Create Poll - POST (store poll in MongoDB)
app.post('/create', isAuthenticated, async (req, res) => {
  const { question, options } = req.body;
  const optionsArray = options.split(',').map(option => ({
    option: option.trim(),
    votes: 0
  }));

  const newPoll = new Poll({ question, options: optionsArray });
  await newPoll.save();

  res.redirect('/');
});

// Vote on a Poll
app.post('/vote/:id', async (req, res) => {
  const pollId = req.params.id;
  const optionIndex = req.body.optionIndex;

  const poll = await Poll.findById(pollId);
  poll.options[optionIndex].votes += 1;
  await poll.save();

  res.redirect('/');
});

// Register Routes

// Register form
app.get('/register', (req, res) => {
  res.render('register');
});

// Register user - POST
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.redirect('/login');
  }

  const newUser = new User({ username, password });
  await newUser.save();
  res.redirect('/login');
});

// Login Routes

// Login form
app.get('/login', (req, res) => {
    res.render('login', { message: req.flash('error') });
  });
  
  // Login user - POST
  app.post('/login', 
    passport.authenticate('local', {
      successRedirect: '/',
      failureRedirect: '/login',
      failureFlash: true // Enable flash messages on failure
    })
  );

// Logout
app.get('/logout', (req, res) => {
  req.logout((err) => {
    res.redirect('/');
  });
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Start the server
app.listen(process.env.PORT, () => {
  console.log('Server running');
});
