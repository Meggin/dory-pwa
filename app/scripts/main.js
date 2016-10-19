/*!
 *
 *  Web Starter Kit
 *  Copyright 2015 Google Inc. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License
 *
 */
/* eslint-env browser */
(function() {
  'use strict';

  // Check to make sure service workers are supported in the current browser,
  // and that the current page is accessed from a secure origin. Using a
  // service worker from an insecure origin will trigger JS console errors. See
  // http://www.chromium.org/Home/chromium-security/prefer-secure-origins-for-powerful-new-features
  var isLocalhost = Boolean(window.location.hostname === 'localhost' ||
      // [::1] is the IPv6 localhost address.
      window.location.hostname === '[::1]' ||
      // 127.0.0.1/8 is considered localhost for IPv4.
      window.location.hostname.match(
        /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
      )
    );

  if ('serviceWorker' in navigator &&
      (window.location.protocol === 'https:' || isLocalhost)) {
    navigator.serviceWorker.register('service-worker.js')
    .then(function(registration) {
      // updatefound is fired if service-worker.js changes.
      registration.onupdatefound = function() {
        // updatefound is also fired the very first time the SW is installed,
        // and there's no need to prompt for a reload at that point.
        // So check here to see if the page is already controlled,
        // i.e. whether there's an existing service worker.
        if (navigator.serviceWorker.controller) {
          // The updatefound event implies that registration.installing is set:
          // https://slightlyoff.github.io/ServiceWorker/spec/service_worker/index.html#service-worker-container-updatefound-event
          var installingWorker = registration.installing;

          installingWorker.onstatechange = function() {
            switch (installingWorker.state) {
              case 'installed':
                // At this point, the old content will have been purged and the
                // fresh content will have been added to the cache.
                // It's the perfect time to display a "New content is
                // available; please refresh." message in the page's interface.
                break;

              case 'redundant':
                throw new Error('The installing ' +
                                'service worker became redundant.');

              default:
                // Ignore
            }
          };
        }
      };
    }).catch(function(e) {
      console.error('Error during service worker registration:', e);
    });
  }

//Global ID of currently signed-in user, needed for authentication.
var currentUID;

var addQuestionSection = document.getElementById('add-question-section');
var questionTitleInput = document.getElementById('new-question-title');
var questionDescriptionInput = document.getElementById('new-question-description');
var answerInput = document.getElementById('answer-input');
var userQuestionsSection = document.getElementById('user-questions-section');
var allQuestionsSection = document.getElementById('all-questions-section');
var answersForQuestionSection = document.getElementById('answers-for-question');
var myQuestionsMenu = document.getElementById('my-questions-menu');
var allQuestionsMenu = document.getElementById('all-questions-menu');
var answersForQuestionButton = document.getElementById('answers');
var listeningFirebaseRefs = [];

window.onload = function() {

  const authContainer = document.getElementById('splash-page-section');
  const allQuestionsSection = document.getElementById('all-questions-section');
  const signInWithGoogleButton = document.getElementById('sign-in-with-google-button');
  const signInAnonymouslyButton = document.getElementById('sign-in-anonymously-button');
  const signOutButton = document.getElementById('sign-out-button');

  //Triggers every time user signs in or signs out.
  firebase.auth().onAuthStateChanged(function(auth) {

    var auth = firebase.auth().currentUser;

    //User authenticated and active session begins.
    if (auth != null) {
      authContainer.style.display =  'none';
      allQuestionsSection.style.display = 'block';
      console.log('User authenticated: ' + auth);
      writeUserData(auth.uid, auth.displayName, auth.email, auth.imageURL);
      return new App(auth);
    //User isn't authenticated.
    } else {
      authContainer.style.display = 'flex';
      allQuestionsSection.style.display = 'none';
      console.log('User not authenticated.');
    }
  });

  signInWithGoogleButton.addEventListener('click', function() {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
    console.log('User signed into Google.');
  });

  signInAnonymouslyButton.addEventListener('click', function() {
    firebase.auth().signInAnonymously().catch(function(error) {
      // Handle Errors here.
      var errorCode = error.code;
      var errorMessage = error.message;

      if (errorCode === 'auth/operation-not-allowed') {
        alert('You must enable Anonymous auth in the Firebase Console.');
      } else {
        console.error(error);
      }
    });
    console.log('User signed in anonymously.');
  });

  signOutButton.addEventListener('click', function() {
    firebase.auth().signOut();
    console.log('User signed out.');
  });
};


//Writes authenticated user's data to database.
function writeUserData(userId, name, email, imageUrl) {
  firebase.database().ref('users/' + userId).set({
    username: name,
    email: email
  });
}
//The main class for an active user session
class App {
  constructor(auth) {
    this.user = auth;
    //**Todo: Indicate which page is active.
    this.activeContainer = null;

    //**Todo: Indicate which data is getting retrieved.
    this.activeRef = null;

    //DOM elements.
    this.addQuestionButton = document.getElementById('add-question');
    this.questionTitleInput = document.getElementById('new-question-title');
    this.questionDescriptionInput = document.getElementById('new-question-description');
    this.submitQuestionForm = document.getElementById('question-form');
    this.submitAnswerForm = document.getElementById('add-answer');
    this.answerInput = document.getElementById('answer-input');
    this.myQuestionsMenu = document.getElementById('my-questions-menu');
    this.allQuestionsMenu = document.getElementById('all-questions-menu');
    this.answersForQuestionButton = document.getElementById('answers');

    // BIND ALL FUNCTIONS!
    this.attachDOMListeners = this.attachDOMListeners.bind(this);
    this.newQuestionForCurrentUser = this.newQuestionForCurrentUser.bind(this);
    this.writeNewQuestion = this.writeNewQuestion.bind(this);
    this.fetchQuestions = this.fetchQuestions.bind(this);
    this.showSection = this.showSection.bind(this);
    this.createQuestionElement = this.createQuestionElement.bind(this);
    this.loadAnswersForQuestion = this.loadAnswersForQuestion.bind(this);
    this.showQuestionDetailsForAnswer = this.showQuestionDetailsForAnswer.bind(this);
    this.createAnswerElement = this.createAnswerElement.bind(this);
    this.createAnswerInDatabase = this.createAnswerInDatabase.bind(this);
    this.toggleStar = this.toggleStar.bind(this);
    this.updateStarredByCurrentUser = this.updateStarredByCurrentUser.bind(this);
    this.updateStarCount = this.updateStarCount.bind(this);
    this.cleanUpUI = this.cleanUpUI.bind(this);

    // Attach listeners
    this.attachDOMListeners();
    this.allQuestionsMenu.click();
  }

  attachDOMListeners() {

    // Shows a user's list of questions.
    this.myQuestionsMenu.addEventListener('click', function() {
      this.showSection(userQuestionsSection, myQuestionsMenu);
      this.cleanUpUI();
      this.fetchQuestions(userQuestionsSection);
    }.bind(this));

    // Shows all questions, ranked by ratings.
    this.allQuestionsMenu.addEventListener('click', function() {
      this.showSection(allQuestionsSection, allQuestionsMenu);
      this.cleanUpUI();
      this.fetchQuestions(allQuestionsSection);
    }.bind(this));

    // View create question page.
    this.addQuestionButton.addEventListener('click', function() {
      this.showSection(addQuestionSection);
    }.bind(this));

    //Submit a new question.
    this.submitQuestionForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var questionBody = questionDescriptionInput.value;
      var questionTitle = questionTitleInput.value;
      var uid = firebase.auth().currentUser;
      this.newQuestionForCurrentUser(questionTitle, questionBody);
      this.fetchQuestions(userQuestionsSection);
      this.showSection(userQuestionsSection, myQuestionsMenu);
      questionDescriptionInput.value = '';
      questionTitleInput.value = '';
    }.bind(this));

    // Submit a new answer for a question.
    this.submitAnswerForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var answer = answerInput.value;
      var username = document.getElementById('username').innerText;
      var questionId = document.getElementById('questionid-holder').innerText;
      this.createAnswerInDatabase(questionId, answer, username);
      answerInput.value = '';
    }.bind(this));
  }

  // Add new question to user's list of questions in database.
  newQuestionForCurrentUser(questionTitle, questionBody) {
    var userId = firebase.auth().currentUser.uid;
    return firebase.database().ref('/users/' + userId).once('value').then(function(snapshot) {
      var username = snapshot.val().username;
      return this.writeNewQuestion(firebase.auth().currentUser.uid, username,
        questionTitle, questionBody);
    }.bind(this));
  }

  /**
   * Saves a new question to the Firebase DB.
   * Responsible for how data is structured in database.
   */
  writeNewQuestion(uid, username, questionTitle, questionBody) {
    // A question entry.
    var questionData = {
      username: username,
      uid: uid,
      questionBody: questionBody,
      title: questionTitle,
      starCount: 0,
    };

    // Get a key for new question.
    var newQuestionKey = firebase.database().ref().child('questions').push().key;

    // Write the new question's data in questions and user-questions lists.
    var updates = {};
    updates['/questions/' + newQuestionKey] = questionData;
    updates['/user-questions/' + uid + '/' + newQuestionKey] = questionData;

    return firebase.database().ref().update(updates);
  }

  // Fetch questions from database and display in lists.
  fetchQuestions(sectionElement) {
    var myUserId = firebase.auth().currentUser.uid;
    if (sectionElement === userQuestionsSection) {
      var questionRef = firebase.database().ref('user-questions/' + myUserId).orderByChild('starCount');
    } else {
      var questionRef = firebase.database().ref('questions').orderByChild('starCount');
    }
    //Clear out old DOM elements.
    var containerElement = sectionElement.getElementsByClassName('questions-container')[0];
    containerElement.innerHTML = '';
    questionRef.limitToLast(25).once('value', function(data) {
      console.log('once value', data.val());
      var questions = data.val();
      Object.keys(questions).forEach(function(questionKey) {
        var questionData = questions[questionKey];
        var username = questionData.username || 'Anonymous';
        containerElement.insertBefore(
          this.createQuestionElement(questionKey, questionData.title, data.val().questionBody, username, data.val().uid),
          containerElement.firstChild)
      }.bind(this))
    }.bind(this));
  }

  // Create question element.
  createQuestionElement(questionId, title, questionBody, username, uid) {
    var uid = firebase.auth().currentUser.uid;

    var html =
      '<li class="question">' +
          '<img class="avatar" src="images/avatar.png"></img>' +
          '<div class="pad flex">' +
            '<h4 class="title"></h4>' +
            '<div class="username mdl-color-text--black"></div>' +
            '<div class="key mdl-color-text--black"></div>' +
            '<div class="questionBody"></div>' +
          '</div>' +
          '<span class="star">' +
            '<div class="not-starred material-icons">star_border</div>' +
            '<div class="starred material-icons">star</div>' +
            '<div class="star-count">0</div>' +
          '</span>' +
          '<button id="answers" class="answers mdl-button mdl-js-button mdl-button--icon">' +
             '<i class="material-icons">comment</i>' +
          '</button>' +
      '</li>';

    // Create the DOM element from the HTML.
    var div = document.createElement('div');
    div.innerHTML = html;
    var questionElement = div.firstChild;

    // Set values.
    questionElement.getElementsByClassName('key')[0].innerText = questionId;
    questionElement.getElementsByClassName('title')[0].innerText = title;
    questionElement.getElementsByClassName('questionBody')[0].innerText = questionBody;
    questionElement.getElementsByClassName('username')[0].innerText = username || 'Anonymous';

    // Variables for action items.
    var star = questionElement.getElementsByClassName('starred')[0];
    var unStar = questionElement.getElementsByClassName('not-starred')[0];
    var answersForQuestionButton = questionElement;

    // Listen for likes counts.
    var starCountRef = firebase.database().ref('questions/' + questionId + '/starCount');
    starCountRef.on('value', (snapshot) => {
      this.updateStarCount(questionElement, snapshot.val());
    });

    // Listen for the starred status.
    var starredStatusRef = firebase.database().ref('questions/' + questionId + '/stars/' + uid);
    starredStatusRef.on('value', (snapshot) => {
      this.updateStarredByCurrentUser(questionElement, snapshot.val());
    });

    // Keep track of all Firebase reference on which we are listening.
    listeningFirebaseRefs.push(starCountRef);
    listeningFirebaseRefs.push(starredStatusRef);

    //Bind starring action.
    var onStarClicked = function() {
      var globalQuestionRef = firebase.database().ref('/questions/' + questionId);
      var userQuestionRef = firebase.database().ref('/user-questions/' + uid + '/' + questionId);
      this.toggleStar(globalQuestionRef, uid);
      this.toggleStar(userQuestionRef, uid);
    };

    unStar.onclick = onStarClicked.bind(this);
    star.onclick = onStarClicked.bind(this);

    // Open list of actions for a question.
    var onAnswersClicked = function() {
      this.showSection(answersForQuestionSection);
      this.showQuestionDetailsForAnswer(questionId, title, questionBody, username);
      this.cleanUpUI(answersForQuestionSection);
      this.loadAnswersForQuestion(questionId);
    }

    answersForQuestionButton.onclick = onAnswersClicked.bind(this);

    return questionElement;
  }

  /**
  * Controls the active view and button.
  */
  showSection(sectionElement, buttonElement) {
    allQuestionsSection.style.display = 'none';
    userQuestionsSection.style.display = 'none';
    addQuestionSection.style.display = 'none';
    answersForQuestionSection.style.display = 'none';
    myQuestionsMenu.classList.remove('is-active');
    allQuestionsMenu.classList.remove('is-active');

    if (sectionElement) {
      sectionElement.style.display = 'block';
    }
    if (buttonElement) {
    buttonElement.classList.add('is-active');
    }
  }

  /**
  * Loads answers for a question from the database.
  */
  loadAnswersForQuestion(questionId) {
    var myUserId = firebase.auth().currentUser.uid;
    var answersForQuestionRef = firebase.database().ref('question-answers/' + questionId);
    //Clear out old DOM elements.
    var containerElement = document.getElementsByClassName('answers-container')[0];
    containerElement.innerHTML = '';
    answersForQuestionRef.limitToLast(25).on('child_added', function(data) {
      var username = data.val().username || 'Anonymous';
      containerElement.insertBefore(
        this.createAnswerElement(questionId, data.val().id, data.val().answer, data.val().username),
        containerElement.firstChild)
    }.bind(this));
  }

  /**
  * Creates the answer element in the DOM.
  */
  createAnswerElement(questionId, id, answer, username) {
    console.log('We are in createanswerelement method.');
    var uid = firebase.auth().currentUser.uid;

    var html =
      '<div class="answer mdl-card mdl-shadow--2dp">' +
        '<div class="header">' +
          '<div>' +
            '<div class="username mdl-color-text--black"></div>' +
          '</div>' +
        '</div>' +
        '<div class="answer"></div>' +
      '</div>';

    // Create the DOM element from the HTML.
    var div = document.createElement('div');
    div.innerHTML = html;
    var answerElement = div.firstChild;

    answerElement.getElementsByClassName('answer')[0].innerText = answer;
    answerElement.getElementsByClassName('username')[0].innerText = username || 'Anonymous';

    return answerElement;
  }

  /**
  * Stores answers for a question in the database.
  */
  createAnswerInDatabase(questionId, answer, username) {
    console.log('We are in createanswerindatabase method.');
    firebase.database().ref('question-answers/' + questionId).push({
      answer: answer,
      author: username,
    });
  }

  /**
  * Displays question details on answer view.
  */
  showQuestionDetailsForAnswer(questionId, title, questionBody, username) {
    document.getElementById('questionid-holder').innerText = questionId;
    document.getElementById('questiontitle-holder').innerText = title;
    document.getElementById('username').innerText = username;
    document.getElementById('questiontext-holder').innerText = questionBody;
  }

  /**
  * Star/unstar question.
  */
  toggleStar(questionRef, uid) {
    questionRef.transaction(function(question) {
      if (question) {
        if (question.stars && question.stars[uid]) {
          question.starCount--;
          question.stars[uid] = null;
        } else {
          question.starCount++;
          if (!question.stars) {
            question.stars = {};
          }
          question.stars[uid] = true;
        }
      }
      return question;
    });
  }

  /**
   * Updates the starred status of the question.
   */
  updateStarredByCurrentUser(questionElement, starred) {
    if (starred) {
      questionElement.getElementsByClassName('starred')[0].style.display = 'inline-block';
      questionElement.getElementsByClassName('not-starred')[0].style.display = 'none';
    } else {
      questionElement.getElementsByClassName('starred')[0].style.display = 'none';
      questionElement.getElementsByClassName('not-starred')[0].style.display = 'inline-block';
    }
  }

  /**
   * Updates the number of stars displayed for a question.
   */
  updateStarCount(questionElement, nbStart) {
    questionElement.getElementsByClassName('star-count')[0].innerText = nbStart;
  }

  /**
   * Clean up UI so we don't see duplicates.
   */
   cleanUpUI(sectionElement) {
    allQuestionsSection.getElementsByClassName('questions-container')[0].innerHTML = '';
    userQuestionsSection.getElementsByClassName('questions-container')[0].innerHTML = '';
    answersForQuestionSection.getElementsByClassName('answers-container')[0].innerHTML = '';
   }
}

})();
