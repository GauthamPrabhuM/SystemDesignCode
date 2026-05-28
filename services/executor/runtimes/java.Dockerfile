FROM eclipse-temurin:21-jdk-alpine

RUN addgroup -S runner && adduser -S runner -G runner
USER runner
WORKDIR /workspace
