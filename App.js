import React, {useState, useEffect, useRef} from 'react';
import * as eva from '@eva-design/eva';
import { ApplicationProvider, Layout, Text, Button, Input, TopNavigation, Divider, List, Spinner, Card, Modal, ViewPager, BottomNavigation, BottomNavigationTab } from '@ui-kitten/components';
import Constants from 'expo-constants';
import VaxLocItem from './VaxLocItem.js';

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

import * as cheerio from 'cheerio';
import * as SQLite from 'expo-sqlite';
import NotifItem from './NotifItem.js';

const htmlparser2 = require('htmlparser2');


// Base url used for fetching voor prullenbakvaccin
const baseURL = "https://www.prullenbakvaccin.nl/";

const testURL = 'https://beta.prullenbakvaccin.nl/'
const DB_NAME = 'TrashVax_DB14.db'


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const [postal, setPostalCode] = useState(null);
  const [cookieInf, setCookieInf] = useState({
    token: null,
    expDate: null,
    maxAge: null
  })
  const [csrf, setCSRF] = useState(null)
  const [debugCsrf, setDebugCSRF] = useState(null)
  const [visibleLocations, setVisibleLocations] = useState(null)
  const [locations, setLocations] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notifVis, setNotifVis] = useState(false)
  const [pageIdx, setPageIdx] = useState(0)
  const [currSetNotifications, setCurrentNotification] = useState([])
  const [backgroundTaskSwitch, setBackgroundTaskSwitch] = useState(false)
  const notificationListener = useRef();
  const responseListener = useRef();

  const db = SQLite.openDatabase(DB_NAME)
  
  const getCookie = () => {
    fetch(baseURL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:88.0) Gecko/20100101 Firefox/88.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Referer': baseURL,
        'Upgrade-Insecure-Requests': '1',
        'TE': 'Trailers',
        'Cache-Control': 'max-age=0',
    }
    })
    .then((res) => {
      let cookieHeaders = Object.assign({}, ...res.headers.get('set-cookie').split(';').map((kv) => ({[kv.split('=')[0].trim()]: kv.split('=')[1]})))

      newCookieInfo = {
        token: cookieHeaders['XSRF-TOKEN'],
        expDate: cookieHeaders['expires'],
        maxAge: cookieHeaders['Max-Age'],
      }
      setCookieInf(newCookieInfo)
    })

    fetch(baseURL, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:88.0) Gecko/20100101 Firefox/88.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Referer': baseURL,
            'Upgrade-Insecure-Requests': '1',
            'TE': 'Trailers',
        }
    }).then((res) => res.text())
    .then((res) => {
      let re = /<meta name="csrf-token" content="(.*)">/;
      var csrfToken = res.match(re)[1]
      setCSRF(csrfToken)
    });
  }

  // Fetch the location info for a given postal code
  // ignoreVisibleLocations doesn't add these fetched locations to the list of locations on the main screen
  //   but adds them to the list of locations on which the user wants to check notifications
  const checkVacTrash = async (currPostalCode, ignoreVisibleLocations) => {
    setLoading(true)

    // Typing in "debug" in the search bar will fetch dummy data from prullenbakvaccin.nl, which should send notifications
    if (currPostalCode.includes('debug')) {
      
      await fetch('https://beta.prullenbakvaccin.nl/', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:88.0) Gecko/20100101 Firefox/88.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
            'TE': 'Trailers'
        }
      })
      .then((res) => res.text())
      .then((res) => {
        // Parse page html
        const dom = htmlparser2.parseDocument(res, 'text/html')
        const $ = cheerio.load(dom)

        // Search for location names, status lines and address lines
        let locNameLines = $('h5 > span:not([style="display:none"])', '.card-body').map((i, el) => {
          return $(el).text();
        }).get();
        let locStatusLines = $('small > span:not([style="display:none"])', '.card-body').map((i, el) => {
          return $(el).text();
        }).get();
        let addressLines = $('p', '.card-body').not('.card-text').map((i, el) => {
          return $(el).text().trim().replace('\n', ' ');
        }).get();
        
        // Filter address lines to only include address
        addressLines = addressLines.filter((line) => {
          return line != '' && !line.includes('Niet bellen') && line != ' ';
        })

        // Create location list that are found on the page
        let vaxLocs = [];
        let addressIdx = 0
        let locStatusIdx = 0
        
        // For each location name found
        for (let locNameIdx = 0; locNameIdx < locNameLines.length; locNameIdx++) {
          let currLocNameLine = locNameLines[locNameIdx].toLowerCase();
          let locName, locPlace, status;

          // If 'locatie' is in the name, vaccines aren't available and have a different format
          if (currLocNameLine.includes('locatie')) {
            locName = 'Location ' + currLocNameLine.split(' ')[1].slice(1)
            locPlace = null
            status = locStatusLines[locStatusIdx] + ' ' + locStatusLines[locStatusIdx+1] + ' ' + locStatusLines[locStatusIdx+2]
            locStatusIdx += 3

          // If 'praktijk' is in the name, vaccines are available and full name is shown on the page
          } else if (currLocNameLine.includes('praktijk')) {
            locName = currLocNameLine
            status = locStatusLines[locStatusIdx] + ' ' + locStatusLines[locStatusIdx+1]
            locPlace = addressLines[addressIdx]
            locStatusIdx += 2
            addressIdx += 1
          }
          
          // Create location and push to new list
          vaxLocs.push({
            'locName': locName,
            'locPlace': locPlace,
            'status': status,
            'belongsToPostal': currPostalCode
          })
        }
        
        // Get a list of postal codes for which the user wants notifications
        let enabledPostalCodes
        if (currSetNotifications !== null) {
          enabledPostalCodes = currSetNotifications.map((postalNotif, i) => {
            return postalNotif['location']
          })
        } else {
          enabledPostalCodes = []
        }

        // If the current postal code is in the list of postal codes,
        // add it to the 'locations' list which keeps track of notifications
        if (enabledPostalCodes.includes(currPostalCode)) {

          // If 'locations' is empty or null, the fetched locations replaces it
          let newLocs
          if (locations == null || locations.length == 0) {
            newLocs = vaxLocs
          } else {
          // Otherwise, we update the specific locations that are fetched,
          // depending on which postal code they belong to
            let filteredCurrPostalCodeLocations = locations.filter((loc) => {
              return loc['belongsToPostal'] !== currPostalCode;
            })
            newLocs = filteredCurrPostalCodeLocations.concat(vaxLocs)
          }

          setLocations(newLocs)
          
          // In case the user has set notifications for this postal code, and is researching
          // the postal code, show the fetched locations on screen
          if (!ignoreVisibleLocations) {
            setVisibleLocations(vaxLocs)
          }

        // Otherwise, the user has searched the "currPostalCode" and it should be shown on screen
        } else {
          setVisibleLocations(vaxLocs)
        }

        // Turn off loading spinner
        setLoading(false)
      });

    // Otherwise, query locations from the "real" prullenbakvaccin.nl website
    } else {
      await fetch(baseURL + '#location-selector', {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:88.0) Gecko/20100101 Firefox/88.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': baseURL,
            'DNT': '1',
            'Connection': 'keep-alive',
            'Referer': baseURL,
            'Upgrade-Insecure-Requests': '1',
            'TE': 'Trailers',
            'Cookie': 'XSRF-TOKEN' + cookieInf.token
        },
        body: `_token=${csrf}&location=${currPostalCode}`
      })
      .then((res) => res.text())
      .then((res) => {
        // Parse page html
        const dom = htmlparser2.parseDocument(res, 'text/html')
        const $ = cheerio.load(dom)

        // Search for location names, status lines and address lines
        let locNameLines = $('h5 > span:not([style="display:none"])', '.card-body').map((i, el) => {
          return $(el).text();
        }).get();
        let locStatusLines = $('small > span:not([style="display:none"])', '.card-body').map((i, el) => {
          return $(el).text();
        }).get();
        let addressLines = $('p', '.card-body').not('.card-text').map((i, el) => {
          return $(el).text().trim().replace('\n', ' ');
        }).get();
        
        // Filter address lines to only include address
        addressLines = addressLines.filter((line) => {
          return line != '' && !line.includes('Niet bellen') && line != ' ';
        })

        // Create location list that are found on the page
        let vaxLocs = [];
        let addressIdx = 0
        let locStatusIdx = 0

        // For each location name found
        for (let locNameIdx = 0; locNameIdx < locNameLines.length; locNameIdx++) {
          let currLocNameLine = locNameLines[locNameIdx].toLowerCase();
          let locName, locPlace, status;
          
          // If 'locatie' is in the name, vaccines aren't available and have a different format
          if (currLocNameLine.includes('locatie')) {
            locName = 'Location ' + currLocNameLine.split(' ')[1].slice(1)
            locPlace = null
            status = locStatusLines[locStatusIdx] + ' ' + locStatusLines[locStatusIdx+1] + ' ' + locStatusLines[locStatusIdx+2]
            locStatusIdx += 3

          // If 'praktijk' is in the name, vaccines are available and full name is shown on the page
          } else if (currLocNameLine.includes('praktijk')) {
            locName = currLocNameLine
            status = locStatusLines[locStatusIdx] + ' ' + locStatusLines[locStatusIdx+1]
            locPlace = addressLines[addressIdx]
            locStatusIdx += 2
            addressIdx += 1
          }
          
          // Create location and push to new list
          vaxLocs.push({
            'locName': locName,
            'locPlace': locPlace,
            'status': status,
            'belongsToPostal': currPostalCode
          })
        }
        
        // Get a list of postal codes for which the user wants notifications
        let enabledPostalCodes
        if (currSetNotifications !== null) {
          enabledPostalCodes = currSetNotifications.map((postalNotif, i) => {
            return postalNotif['location']
          })
        } else {
          enabledPostalCodes = []
        }

        // If the current postal code is in the list of postal codes,
        // add it to the 'locations' list which keeps track of notifications
        if (enabledPostalCodes.includes(currPostalCode)) {
          
          // If 'locations' is empty or null, the fetched locations replaces it
          let newLocs
          if (locations == null || locations.length == 0) {
            newLocs = vaxLocs
          } else {
            // Otherwise, we update the specific locations that are fetched,
            // depending on which postal code they belong to
            let filteredCurrPostalCodeLocations = locations.filter((loc) => {
              return loc['belongsToPostal'] !== currPostalCode;
            })
    
            newLocs = filteredCurrPostalCodeLocations.concat(vaxLocs)
          }

          setLocations(newLocs)
          
          // In case the user has set notifications for this postal code, and is researching
          // the postal code, show the fetched locations on screen
          if (!ignoreVisibleLocations) {
            setVisibleLocations(vaxLocs)
          }

        // Otherwise, the user has searched the "currPostalCode" and it should be shown on screen
        } else {
          setVisibleLocations(vaxLocs)
        }

        // Turn off loading spinner
        setLoading(false)
      });
    }

  }
  
  // Updates status for locations closest to the postal
  // codes the user has set notifications for
  const updateVaxTrashStatus = () => {

    // Collect promises from 'checkVacTrash' functions for each postal code
    const promises = []
    for (let i = 0; i < currSetNotifications.length; i++) {
      let currPostal = currSetNotifications[i]['location']

      promises.push(checkVacTrash(currPostal, true))
    }

    // When the promises are complete, check for which notifications to send
    Promise.all(promises).then(() => {
      // Collect postal codes for which user wants notifications
      let enabledPostalCodes = currSetNotifications.map((postalNotif, i) => {
        if (postalNotif['notifs_on']) {
          return postalNotif['location']
        }
      });
      
      // If locations are not null
      if (locations !== null) {
        // CHeck each location and send notification if 'geen' is not in the status
        locations.map(async (locInf, i) => {
          let newStatus = locInf['status']
          let belongsToPostal = locInf['belongsToPostal']
          if (!newStatus.includes('geen') && enabledPostalCodes.includes(belongsToPostal)) {
            await sendPushNotification(expoPushToken, locInf);
          } else {
          }
        })
      }
      console.log('updated trash vax location status')
    })
  }

  // Inserts a new postal code into the SQLite database
  const insertNotificationDB = () => {
    db.transaction(tx => {
      tx.executeSql(
        "insert into locs (location) values (?)", [postal]
      )
    }, (err) => {
      console.log(err)
      // Read locations from database on completion
      readNotificationsDB()
    }, readNotificationsDB)
  }

  // Reads postal codes from database and sets them to 'currSetNotification' state
  const readNotificationsDB = () => {
    db.transaction(tx => {
      tx.executeSql(
        "select * from locs;",
        null, (_, {rows: {_array}}) => {
          let newNotifs = []
          for (let i = 0; i < _array.length; i++) {
            newNotifs.push({
              "location": _array[i]["location"],
              "notifs_on": false
            })
          }
          setCurrentNotification(newNotifs)
        }
      )
    })
  }

  // Turns off notifications for a given postal code
  const turnOffNotifsForPost = (selectedPostal) => {
    // Set 'notifs_on' to false
    let remIdx = currSetNotifications.findIndex(x => x['location'] == selectedPostal)
    let currSetNotifCopy = [...currSetNotifications]
    currSetNotifCopy.splice(remIdx, 1, {
      'location': selectedPostal,
      'notifs_on': false
    })
    setCurrentNotification(currSetNotifCopy)

    // Remove any item in the 'locations' list that belongs to the postal code
    if (locations !== null && locations.length > 0) {
      let notifLocsCopy = [...locations]
      notifLocsCopy = notifLocsCopy.filter((notifLoc) => {
        return notifLoc['belongsToPostal'] !== selectedPostal
      })

      setLocations(notifLocsCopy)
    }
  }

  // Re-enables notification for a given postal code
  const turnOnNotifsForPost = (selectedPostal) => {
    // Set 'notifs_on' to true
    let remIdx = currSetNotifications.findIndex(x => x['location'] == selectedPostal)
    let currSetNotifCopy = [...currSetNotifications]
    currSetNotifCopy.splice(remIdx, 1, {
      'location': selectedPostal,
      'notifs_on': true
    })
    setCurrentNotification(currSetNotifCopy)

    // Fetch and add location info of the re-enabled postal code
    checkVacTrash(selectedPostal, true)

    // Reassure that the background task is registered
    registerBackgroundTask()
  }

  
  // Define background task that refetches location information
  TaskManager.defineTask('CHECK_TRASHVAX_STATUS', () => {
    try {
      updateVaxTrashStatus()
      return visibleLocations ? BackgroundFetch.Result.NewData : BackgroundFetch.Result.NoData;
    } catch (err) {
      return BackgroundFetch.Result.Failed
    }
  })

  // Register background task that refetches location information
  const registerBackgroundTask = () => {
    BackgroundFetch.registerTaskAsync('CHECK_TRASHVAX_STATUS', {'minimumInterval': 5})
  }
  
  useEffect(() => {

    // Initialise database table if it doesn't exist
    db.transaction(tx => {
      tx.executeSql(
        "create table if not exists locs (location text unique)"
      )
    })

    // Fetch postal codes from the database
    readNotificationsDB()

    // Get cookie information for requests
    getCookie();

    // Register the background task to refetch information
    registerBackgroundTask();

    // Register push notifications
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    // This listener is fired whenever a notification is received while the app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    // This listener is fired whenever a user taps on or interacts with a notification (works when app is foregrounded, backgrounded, or killed)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log(response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  // Function component which renders location list
  const LocationsList = (props) => {
    const locs = props['locs']
    if (locs == null) {
      return (<Text>Please submit a postal code to view nearby locations</Text>)
    } else if (locs.length === 0) {
      return (<Text>No locations in your area</Text> )
    } else {
      return (
      <List
        style={{maxHeight: 400}}
        data={locs}
        renderItem={VaxLocItem}
        ItemSeparatorComponent={Divider}
      />)
    }
  }

  // Function component which renders notification list
  const NotificationsList = (props) => {
    const notifs = props['notifs']

    if (notifs == null || notifs.length == 0) {
      return (<Text>No notifications found. Set notifications screen in the "Set New Notification" tab.</Text>)
    } else {

      let notifData = notifs.map((notif, i) => {
        return {
          'location': notif['location'],
          'notifs_on': notif['notifs_on'],
          'notifOffFunc': turnOffNotifsForPost,
          'notifOnFunc': turnOnNotifsForPost
        }
      })
      return (
        <List
          style={{maxHeight: 800}}
          data={notifData}
          renderItem={NotifItem}
          ItemSeparatorComponent={Divider}
        />
      )
    }
  }

  return (
    <ApplicationProvider {...eva} theme={eva.light}>
      <Layout level='1'>
        <TopNavigation 
          alignment='center'
          title={() => {return (
            <Text category='h4'>TrashVax</Text>
          )}}
          style={{marginTop: 20}}
        />
        <Divider/>
      </Layout>
      <ViewPager
        selectedIndex={pageIdx}
        onSelect={idx => setPageIdx(idx)}
      >
        <Layout level='2' style={{marginHorizontal: 10}}>
          <Layout style={{alignItems: 'center'}}>
            <Text category='h4' style={{marginVertical: 10}}>Fill in your postal code here</Text>
            <Layout style={{ flexDirection: 'row', marginVertical: 10}}>
              <Input
                placeholder='eg. 1234'
                value={postal}
                onChangeText={(postal) => setPostalCode(postal)}
                onSubmitEditing={() => checkVacTrash(postal, false)}
              />
              <Button onPress={() => checkVacTrash(postal, false)}>
                <Text>Search</Text>
              </Button>
            </Layout>
          </Layout>
          {loading ? 
          <Layout style={{alignItems: 'center'}}>
            <Spinner size='large' />
          </Layout>
          :
          <Layout style={{justifyContent: 'space-between'}}>
            {visibleLocations !== null && 
            <Text category='h4'>Locations in your region ({visibleLocations.length})</Text>}
            <Layout>
              <LocationsList locs={visibleLocations}/>
            </Layout>
            {visibleLocations !== null && 
            <Layout style={{alignItems: 'center'}}>
              <Text category='h6' style={{marginVertical:10}}>
                Set interval (seconds) for the app to check if there are vaccines available at the above locations
              </Text>
              <Modal visible={notifVis}>
                <Card>
                  <Text>Notification has been added, please enable it in the next screen.</Text>
                  <Button onPress={() => setNotifVis(false)}>
                    Dismiss
                  </Button>
                </Card>
              </Modal>
              <Button
                onPress={() => {
                  insertNotificationDB()
                  registerBackgroundTask()
                  setNotifVis(true)
                }}
                style={{alignSelf: 'center', width: '100%', marginVertical: 20, height: 50}}
              >
                <Text>Set Notification</Text>
              </Button>
            </Layout>
            }
              
            </Layout>
          }
        </Layout>
        <Layout level='2' style={{justifyContent: 'space-between'}}>
          <Text category='h4' style={{marginVertical: 10, alignSelf: 'center'}}>View/Edit notifications</Text>
          <Layout style={{alignContent: 'center'}}>
            <NotificationsList notifs={currSetNotifications}/>
          </Layout>
        </Layout>
      </ViewPager>
      <BottomNavigation
        selectedIndex={pageIdx}
        onSelect={idx => setPageIdx(idx)}
        style={{position: 'absolute', bottom: 0}}
      >
        <BottomNavigationTab 
          title='Set New Notification'
        />
        <BottomNavigationTab 
          title='View Notifications'
        />
      </BottomNavigation>
    </ApplicationProvider>
    )
}

async function sendPushNotification(expoPushToken, locationInfo) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: 'Vaccine available near you at ' + locationInfo['locName'],
    body: 'Location ' + locationInfo['locPlace'] + '. Go to www.prullenbakvaccin.nl for more information',
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

async function registerForPushNotificationsAsync() {
  let token;
  if (Constants.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    alert('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}