FROM node:20-alpine

RUN apk add --no-cache tini \
    && npm install -g tsx@4
USER node
WORKDIR /workspace
ENTRYPOINT ["/sbin/tini", "--"]
