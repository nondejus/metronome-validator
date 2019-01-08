FROM patidarmanoj/metronome-base:latest

WORKDIR /usr/src/metronome-validator
COPY . .
RUN npm install
CMD tail -f /dev/null