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

  // Shortcuts to DOM Elements.
var questionForm = document.getElementById('question-form');
var questionDescriptionInput = document.getElementById('new-question-description');
var questionTitleInput = document.getElementById('new-question-title');
var answerForm = document.getElementById('add-answer');
var answerInput = document.getElementById('answer-input');
var signInButton = document.getElementById('sign-in-button');
var signOutButton = document.getElementById('sign-out-button');
var splashPage = document.getElementById('page-splash');
var addQuestion = document.getElementById('add-question');
var addButton = document.getElementById('add');
var allQuestionsSection = document.getElementById('all-questions-list');
var userQuestionsSection = document.getElementById('user-questions-list');
var questionCommentsSection = document.getElementById('question-comments-list');
var questionsMenuButton = document.getElementById('menu-questions');
var myQuestionsMenuButton = document.getElementById('menu-my-questions');
var listeningFirebaseRefs = [];

/**
 * Saves a new question to the Firebase DB.
 * Responsible for how data is structured in database.
 */
function writeNewQuestion(uid, username, title, questionBody) {
  // A question entry.
  var questionData = {
    author: username,
    uid: uid,
    questionBody: questionBody,
    title: title,
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

/**
 * Star/unstar question.
 */
function toggleStar(questionRef, uid) {
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
 * Creates a question element.
 */
function createQuestionElement(questionId, title, questionBody, author, authorId) {
  var uid = firebase.auth().currentUser.uid;

  var html =
      '<li class="question">' +
        '<div>' +
          '<h4 class="title"></h4>' +
          '<div class="username mdl-color-text--black"></div>' +
          '<div class="key mdl-color-text--black"></div>' +
          '<span class="star">' +
            '<div class="not-starred material-icons">star_border</div>' +
            '<div class="starred material-icons">star</div>' +
            '<div class="star-count">0</div>' +
          '</span>' +
          '<div class="questionBody"></div>' +
          '<button class="comments mdl-button mdl-js-button mdl-button--icon">' +
             '<i class="material-icons">comment</i>' + 
          '</button>' +
        '</div>' +
      '</li>';

  // Create the DOM element from the HTML.
  var div = document.createElement('div');
  div.innerHTML = html;
  var questionElement = div.firstChild;

  var star = questionElement.getElementsByClassName('starred')[0];
  var unStar = questionElement.getElementsByClassName('not-starred')[0];
  var viewAnswers = questionElement.getElementsByClassName('comments')[0];

  // Set values.
  questionElement.getElementsByClassName('questionBody')[0].innerText = questionBody;
  questionElement.getElementsByClassName('title')[0].innerText = title;
  questionElement.getElementsByClassName('username')[0].innerText = author || 'Anonymous';
  questionElement.getElementsByClassName('key')[0].innerText = questionId;

  // Listen for likes counts.
  // [START question_value_event_listener]
  var starCountRef = firebase.database().ref('questions/' + questionId + '/starCount');
  starCountRef.on('value', function(snapshot) {
    updateStarCount(questionElement, snapshot.val());
  });
  // [END question_value_event_listener]

  // Listen for the starred status.
  var starredStatusRef = firebase.database().ref('questions/' + questionId + '/stars/' + uid)
  starredStatusRef.on('value', function(snapshot) {
    updateStarredByCurrentUser(questionElement, snapshot.val());
  });

  // Keep track of all Firebase reference on which we are listening.
  listeningFirebaseRefs.push(starCountRef);
  listeningFirebaseRefs.push(starredStatusRef);

  // Bind starring action.
  var onStarClicked = function() {
    var globalQuestionRef = firebase.database().ref('/questions/' + questionId);
    var userQuestionRef = firebase.database().ref('/user-questions/' + authorId + '/' + questionId);
    toggleStar(globalQuestionRef, uid);
    toggleStar(userQuestionRef, uid);
  };

  var onAnswersClicked = function() {
    showAnswers(title, questionId, questionBody, questionCommentsSection);
  }

  unStar.onclick = onStarClicked;
  star.onclick = onStarClicked;
  viewAnswers.onclick = onAnswersClicked;

  return questionElement;
}

/**
 * Creates answer element.
 */
function createAnswerElement(questionId, id, answer, author) {
  var uid = firebase.auth().currentUser.uid;

  var html =
      '<div class=" answer mdl-card mdl-shadow--2dp">' +
        '<div class="header">' +
          '<div>' +
            '<div class="username mdl-color-text--black"></div>' +
          '</div>' +
          '<div class="key"></div>' +
        '</div>' +
        '<div class="answer"></div>' +
      '</div>';

  // Create the DOM element from the HTML.
  var div = document.createElement('div');
  div.innerHTML = html;
  var answerElement = div.firstChild;

  answerElement.getElementsByClassName('answer')[0].innerText = answer;
  answerElement.getElementsByClassName('username')[0].innerText = author || 'Anonymous';
  answerElement.getElementsByClassName('key')[0].innerText = questionId;

  return answerElement;
}

/**
 * Updates the starred status of the question.
 */
function updateStarredByCurrentUser(questionElement, starred) {
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
function updateStarCount(questionElement, nbStart) {
  questionElement.getElementsByClassName('star-count')[0].innerText = nbStart;
}

/**
 * Starts listening for new questions and populates questions lists.
 */
function startDatabaseQueries() {
  var myUserId = firebase.auth().currentUser.uid;
  var recentQuestionsRef = firebase.database().ref('questions').orderByChild('starCount');
  var userQuestionsRef = firebase.database().ref('user-questions/' + myUserId).orderByChild('starCount');

  var fetchQuestions = function(questionsRef, sectionElement) {
    questionsRef.on('child_added', function(data) {
      var author = data.val().author || 'Anonymous';
      var containerElement = sectionElement.getElementsByClassName('questions-container')[0];
      containerElement.insertBefore(
          createQuestionElement(data.key, data.val().title, data.val().questionBody, author, data.val().uid),
          containerElement.firstChild);
    });
  };

  // Fetching and displaying all questions of each sections.
  fetchQuestions(recentQuestionsRef, allQuestionsSection);
  fetchQuestions(userQuestionsRef, userQuestionsSection);

  // Keep track of all Firebase refs we are listening to.
  listeningFirebaseRefs.push(recentQuestionsRef);
  listeningFirebaseRefs.push(userQuestionsRef);
}

function loadAndDisplayAnswers(questionId) {

  var answersRef = firebase.database().ref('question-answers/' + questionId);

  var fetchAnswers = function(inAnswersRef, questionId, sectionElement) {
      inAnswersRef.on('child_added', function(data) {
      var author = data.val().author || 'Anonymous';
      var answersContainer = questionCommentsSection.getElementsByClassName('answers-container')[0];
      answersContainer.insertBefore(
        createAnswerElement(questionId, data.val().id, data.val().answer, data.val().author),
        answersContainer.firstChild);
    });
  };

  fetchAnswers(answersRef, questionId, questionCommentsSection);

  listeningFirebaseRefs.push(answersRef);
  answersRef.off('child_added');

}


/**
 * Writes the user's data to the database.
 */
// [START basic_write]
function writeUserData(userId, name, email, imageUrl) {
  firebase.database().ref('users/' + userId).set({
    username: name,
    email: email
  });
}
// [END basic_write]

/**
 * Cleanups the UI and removes all Firebase listeners.
 */
function cleanupUi() {
  // Remove all previously displayed questions.
  allQuestionsSection.getElementsByClassName('questions-container')[0].innerHTML = '';
  userQuestionsSection.getElementsByClassName('questions-container')[0].innerHTML = '';

  // Stop all currently listening Firebase listeners.
  listeningFirebaseRefs.forEach(function(ref) {
    ref.off();
  });
  listeningFirebaseRefs = [];
}

/**
 * The ID of the currently signed-in User. We keep track of this to detect Auth state change events that are just
 * programmatic token refresh but not a User status change.
 */
var currentUID;

/**
 * Triggers every time there is a change in the Firebase auth state (i.e. user signed-in or user signed out).
 */
function onAuthStateChanged(user) {
  // We ignore token refresh events.
  if (user && currentUID === user.uid || !user && currentUID === null) {
    return;
  }
  currentUID = user ? user.uid : null;

  cleanupUi();
  if (user) {
    splashPage.style.display = 'none';
    writeUserData(user.uid, user.displayName, user.email);
    startDatabaseQueries();
  } else {
    // Display the splash page where you can sign-in.
    splashPage.style.display = '';
  }
}

/**
 * Creates a new question for the current user.
 */
function newQuestionForCurrentUser(title, questionBody) {
  // [START single_value_read]
  var userId = firebase.auth().currentUser.uid;
  return firebase.database().ref('/users/' + userId).once('value').then(function(snapshot) {
    var username = snapshot.val().username;
    // [START_EXCLUDE]
    return writeNewQuestion(firebase.auth().currentUser.uid, username,
        title, questionBody);
    // [END_EXCLUDE]
  });
  // [END single_value_read]
}

/**
 * Writes a new answer for the given question.
 */
function createNewAnswer(questionId, answer, username) {
  firebase.database().ref('question-answers/' + questionId).push({
    answer: answer,
    author: username,
  });
}


/**
 * Displays the given section element and changes styling of the given button.
 */
function showSection(sectionElement, buttonElement) {
  allQuestionsSection.style.display = 'none';
  userQuestionsSection.style.display = 'none';
  addQuestion.style.display = 'none';
  questionCommentsSection.style.display = 'none';
  questionsMenuButton.classList.remove('is-active');
  myQuestionsMenuButton.classList.remove('is-active');

  if (sectionElement) {
    sectionElement.style.display = 'block';
  }
  if (buttonElement) {
    buttonElement.classList.add('is-active');
  }
}

/**
 * Displays the given section element and changes styling of the given button.
 */
function showAnswers(title, questionId, questionBody, sectionElement) {
  questionCommentsSection.style.display = 'block';
  allQuestionsSection.style.display = 'none';
  userQuestionsSection.style.display = 'none';
  addQuestion.style.display = 'none';
  
  // PODGE & Meggin
  document.getElementById('questiontitle-holder').value = title;
  document.getElementById('questiontitle-holder').innerText = title;
  document.getElementById('questionid-holder').value = questionId;
  document.getElementById('questionid-holder').innerText = questionId;
  document.getElementById('questiontext-holder').value = questionBody;
  document.getElementById('questiontext-holder').innerText = questionBody;

  var answerRef = firebase.database().ref('questions-answers/' + questionId);
  answerRef.once('value', function(snapshot) {
    snapshot.forEach(function(childSnapshot) {
  
    var answersContainer = questionCommentsSection.getElementsByClassName('answers-container')[0];
      answersContainer.insertBefore(
        createAnswerElement(questionId, childSnapshot.val().id, childSnapshot.val().answer, childSnapshot.val().author), 
        answersContainer.firstChild);
    });
  });


  //loadAndDisplayAnswers(questionId);

 }

// Bindings on load.
window.addEventListener('load', function() {
  // Bind Sign in button.
  signInButton.addEventListener('click', function() {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
  });

  // Bind Sign out button.
  signOutButton.addEventListener('click', function() {
    firebase.auth().signOut();
  });

  // Listen for auth state changes
  firebase.auth().onAuthStateChanged(onAuthStateChanged);

    // Saves answer on form submit.
  answerForm.onsubmit = function(e) {
    e.preventDefault();
    var answer = answerInput.value;

// PODGE
    var questionId = document.getElementById('questionid-holder').value;
    createNewAnswer(questionId, answer, firebase.auth().currentUser.displayName);
    loadAndDisplayAnswers(questionId);
    answerInput.value = '';
  };

  // Saves question on form submit.
  questionForm.onsubmit = function(e) {
    e.preventDefault();
    var questionBody = questionDescriptionInput.value;
    var title = questionTitleInput.value;
    if (questionBody && title) {
      newQuestionForCurrentUser(title, questionBody).then(function() {
        myQuestionsMenuButton.click();
      });
      questionDescriptionInput.value = '';
      questionTitleInput.value = '';
    }
  };

  // Bind menu buttons.
  questionsMenuButton.onclick = function() {
    showSection(allQuestionsSection, questionsMenuButton);
  };
  myQuestionsMenuButton.onclick = function() {
    showSection(userQuestionsSection, myQuestionsMenuButton);
  };
  addButton.onclick = function() {
    showSection(addQuestion);
    questionDescriptionInput.value = '';
    questionTitleInput.value = '';
  };
  questionsMenuButton.onclick();

}, false);

})();
