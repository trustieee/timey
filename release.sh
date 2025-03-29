#!/bin/bash

# Function to increment version number (MAJOR.MINOR.PATCH)
increment_version() {
  local version=$1
  local release_type=$2
  
  # Split version into components
  IFS='.' read -r -a version_parts <<< "$version"
  local major="${version_parts[0]}"
  local minor="${version_parts[1]}"
  local patch="${version_parts[2]}"
  
  case $release_type in
    major)
      major=$((major+1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor+1))
      patch=0
      ;;
    patch|*)
      patch=$((patch+1))
      ;;
  esac
  
  echo "$major.$minor.$patch"
}

# Get current version from package.json
current_version=$(grep -o '"version": "[^"]*' package.json | cut -d'"' -f4)
echo "Current version: $current_version"

# Ask for release type
echo "Release type (patch, minor, major)? [patch]"
read release_type
release_type=${release_type:-patch}

# Compute new version
new_version=$(increment_version "$current_version" "$release_type")
echo "New version will be: $new_version"

# Ask for confirmation
echo "Proceed with release? (y/n) [y]"
read proceed
proceed=${proceed:-y}

if [ "$proceed" != "y" ]; then
  echo "Release cancelled."
  exit 0
fi

# Update version in package.json
sed -i '' "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/" package.json

echo "Updated package.json version to $new_version"

# Ask for commit message
echo "Enter commit message [Release v$new_version]:"
read commit_message
commit_message=${commit_message:-"Release v$new_version"}

# Git operations
git add .
echo "Changes staged."

git commit -m "$commit_message"
echo "Changes committed."

git push origin main
echo "Pushed to main branch."

git tag "v$new_version"
echo "Created tag v$new_version."

git push origin "v$new_version"
echo "Pushed tag to origin."

echo ""
echo "🚀 Release v$new_version complete! GitHub Actions should start building the release soon."
echo "Check https://github.com/trustieee/timey/actions for build status." 