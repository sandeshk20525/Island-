#!/bin/sh

# Precise lightweight gradle launcher wrapper for Linux/macOS
# If standard gradle wrapper jar is missing, we redirect directly to local system gradle installation.

if [ -f "./gradle/wrapper/gradle-wrapper.jar" ]; then
    exec java -jar ./gradle/wrapper/gradle-wrapper.jar "$@"
else
    echo "Using system-wide gradle compiler to build..."
    exec gradle "$@"
fi
