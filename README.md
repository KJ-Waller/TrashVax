# TrashVax -- UPDATED
Android app (made in React Native) for checking www.prullenbakvaccin.nl. You can set notifications to be informed when vaccins are available in your area. The app periodically checks in the background if vaccines are available. Checks happen more consistently when the device is plugged in and charging. 

# Installation
To install the app, click on the .apk file above, then download from github onto your Android device (or click [this link to download](https://github.com/KJ-Waller/TrashVax/raw/main/TrashVax-390351bef2064b71a0fb160b90db8929-signed.apk). Once downloaded, install the apk file.

# Usage
1. Open the app, fill in your postal code, and hit the search button.
2. After a couple of seconds, the local vaccine locations that would show normally on prullenbakvaccin should be listed.
3. Hit the "Set notification" button to add a notification to listen for these vaccination locations. NOTE: This does NOT enable notifications yet.
4. Proceed to the "View Notifications" screen and "enable" notifications for the postal codes you'd like to receive notifications for.
5. Leave the app open in the background (do not close it). You'll receive a notification when vaccinations are avaialble near the enabled postal codes.

# Testing
To test the app for notifications, type in "debug" in the postal code field > hit search > click "set notification" > click on "View notifications" > enable notification for "debug". You should be notified shortly that vaccines are available at 3 "fake" locations. 

# Disclaimers
* The app may break if "prullenbakvaccin.nl" changes their layout.
* Many Android phones have some kind of battery optimization in the settings. Please make exceptions for TrashVax and lock the app to consistently get notified for available vaccines.

# Screenshots
![Screenshot_20210520-184419__01](https://user-images.githubusercontent.com/28184973/119033623-b7427a00-b9ad-11eb-958a-b849064977f5.jpg)
![Screenshot_20210520-184750__01](https://user-images.githubusercontent.com/28184973/119033624-b7db1080-b9ad-11eb-9367-ef0a4a677dca.jpg)
![Screenshot_20210520-204543__01__01__01__01__01__01](https://user-images.githubusercontent.com/28184973/119033618-b6114d00-b9ad-11eb-8a6f-7ed1390d4d0e.jpg)
