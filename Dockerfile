FROM ubuntu:18.04

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git

RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get install -y nodejs

WORKDIR /usr/src/metronome-validator
COPY package.json .
COPY package-lock.json .
RUN npm install
COPY . .
RUN npm run postinstall
CMD ["node", "index.js", "launch"]
