FROM gcc:13
RUN useradd --create-home --shell /bin/bash runner
USER runner
WORKDIR /workspace
