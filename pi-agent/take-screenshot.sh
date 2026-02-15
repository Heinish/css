#!/bin/bash
# Wrapper script to take screenshot as the X11 user
# This runs entirely in the user's context, avoiding sudo environment issues

export DISPLAY=:0
export XAUTHORITY="$HOME/.Xauthority"
scrot "$1"
