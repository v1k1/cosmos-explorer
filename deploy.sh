#!/bin/sh

echo Adding alias for npm...
alias npm="npm --force"

echo Running npm install...
npm install

echo Running build command...
npm run build

echo Deployment complete.
