FROM node:latest
ADD ./ /srv/testapp
EXPOSE 3333
WORKDIR /srv/testapp/
CMD env node testapp.js
