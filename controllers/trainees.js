const Trainee = require("../models/trainee");
const Training = require("../models/training");
const User = require("../models/user");
const dayjs = require("dayjs");
const bcrypt = require("bcrypt");
const getNavFields = require("../views/navBar");

const saltRounds = 10;

const requirements = require("../currencyRequirements");

const index = async (req, res) => {
  const trainees = await Trainee.find({}).sort({ name: 1 });
  const navFields = getNavFields(req.session.account);
  res.render("trainees/index", {
    trainees,
    getOverallStatus: requirements.getOverallStatus,
    dayjs,
    navFields,
  });
};

const show = async (req, res) => {
  const { traineeId } = req.params;
  const trainee = await Trainee.findById(traineeId);
  const nextBooked = {};
  const waitlists = {};
  const statuses = {};

  for (const currency of trainee.currencies) {
    const booking = await Training.findOne(
      {
        type: currency.type,
        trainees: traineeId,
        complete: false,
      },
      "start"
    );
    const waitlist = await Training.findOne(
      {
        type: currency.type,
        waitlist: traineeId,
        complete: false,
      },
      "start"
    );
    if (booking) {
      nextBooked[currency.type] = booking;
    } else if (waitlist) {
      waitlists[currency.type] = waitlist;
    }
    statuses[currency.type] = requirements.getStatus(currency.expiry);
  }
  const overallStatus = requirements.getOverallStatus(trainee);

  trainee.currencies.sort((a, b) => a.expiry - b.expiry);

  const navFields = getNavFields(req.session.account);
  res.render("trainees/show", {
    trainee,
    nextBooked,
    waitlists,
    statuses,
    overallStatus,
    dayjs,
    navFields,
  });
};

const newTrainee = (req, res) => {
  const navFields = getNavFields(req.session.account);
  res.render("trainees/new", {
    requirementNames: requirements.names,
    message: "",
    navFields,
  });
};

const create = async (req, res) => {
  const users = await User.find({}, "userId");
  const userIds = users.map((user) => user.userId);
  const { userId, password, confirmPassword } = req.body;

  const navFields = getNavFields(req.session.account);
  if (userIds.includes(userId)) {
    res.render("trainees/new", {
      requirementNames: requirements.names,
      message: "Username already taken",
      trainee: clearPasswords(req.body),
      navFields,
    });
    return;
  }
  if (password !== confirmPassword) {
    res.render("trainees/new", {
      message: "Passwords must match",
      requirementNames: requirements.names,
      trainee: clearPasswords(req.body),
      navFields,
    });
    return;
  }
  console.log("after verification");

  const newTrainee = await Trainee.create(fillTraineeFromBody({}, req.body));

  const newUser = {
    userId: req.body.userId,
    password: await bcrypt.hash(password, saltRounds),
    account: "trainee",
    traineeId: newTrainee._id,
  };
  await User.create(newUser);

  res.redirect("/trainees");
};

const deleteTrainee = async (req, res) => {
  const { traineeId } = req.params;
  const deletingUser = User.findOneAndDelete({ traineeId: traineeId });
  const deletingTrainee = Trainee.findByIdAndDelete(traineeId);

  await Promise.all([deletingUser, deletingTrainee]);
  res.redirect("/trainees");
};

const edit = async (req, res) => {
  const { traineeId } = req.params;
  const trainee = await Trainee.findById(traineeId);
  //   res.send(JSON.stringify(trainee));
  const requirementNames = requirements.names;

  const navFields = getNavFields(req.session.account);
  res.render("trainees/edit", {
    trainee,
    message: "",
    requirementNames,
    dayjs,
    navFields,
  });
};

const update = async (req, res) => {
  const { traineeId } = req.params;

  console.log(req.body);
  const trainee = await Trainee.findById(traineeId);
  await fillTraineeFromBody(trainee, req.body).save();

  res.redirect(/trainees/ + trainee._id);
};

const fillTraineeFromBody = (newTrainee, body) => {
  newTrainee.name = body.name.trim();
  newTrainee.dOB = body.dOB;
  newTrainee.seniority = body.seniority;
  newTrainee.contact = body.contact;
  newTrainee.vehNum = body.vehNum;
  newTrainee.currencies = [];
  requirements.names.forEach((name) => {
    const currency = {
      type: name,
      expiry: body[name],
    };
    if (name !== "DFS YOGA" || newTrainee.seniority !== "Senior")
      newTrainee.currencies.push(currency);
  });
  return newTrainee;
};

const clearPasswords = (body) => {
  body.password = "";
  body.confirmPassword = "";
  return body;
};

module.exports = {
  index,
  show,
  new: newTrainee,
  create,
  delete: deleteTrainee,
  edit,
  update,
};
