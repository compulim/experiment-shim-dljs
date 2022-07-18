import './App.css';
import { DirectLine } from 'botframework-directlinejs';
import { useEffect, useMemo, useState } from 'react';
import Observable from 'core-js/features/observable';
import ReactWebChat from 'botframework-webchat';
import shareObservable from './shareObservable';

class PatchedDirectLine extends DirectLine {
  /**
   * When `activity$` is set by the original DirectLineJS, we will modify it as a "patched" `activity$`.
   *
   * Later, when Web Chat get `activity$`, we will give it a patched version of `activity$`.
   */
  set activity$(value) {
    // "shareObservable" is a hack because DirectLineJS is not strictly ES Observable-compliant:
    // - ES Observable: Calling subscribe() multiple times SHOULD result in multiple connections.
    // - DirectLineJS: Calling subscribe() multiple times will only result in a single connection.
    //                 All subscriptions are "sharing" the same connection.
    //                 The last unsubscription will terminate the connection.
    super.activity$ = shareObservable(
      new Observable(observer => {
        value.subscribe({
          complete() {
            observer.complete();
          },
          error(err) {
            observer.error(err);
          },
          next(activity) {
            if (typeof activity.text === 'string') {
              return observer.next({
                ...activity,
                text: activity.text.toUpperCase()
              });
            }

            observer.next(activity);
          }
        });
      })
    );
  }
}

function App() {
  const [token, setToken] = useState(false);
  const directLine = useMemo(() => {
    if (!token) {
      return;
    }

    return new PatchedDirectLine({ token });
  }, [token]);

  useEffect(() => {
    (async function () {
      const res = await fetch('https://webchat-mockbot.azurewebsites.net/directline/token', { method: 'POST' });

      if (!res.ok) {
        throw new Error('MockBot returned error while fetching token.');
      }

      const { token } = await res.json();

      setToken(token);
    })();
  }, [setToken]);

  return (
    directLine && (
      <div className="app">
        <ReactWebChat directLine={directLine} />
      </div>
    )
  );
}

export default App;
