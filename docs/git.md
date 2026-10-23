# 1. Switch to your local main branch
git switch main 
git checkout main

# 2. Download the latest changes from the main repo (does not modify your code yet)
git fetch upstream

# 3. Safely merge those changes into your local main branch
git merge upstream/main

# Switch to your feature branch
git checkout sub-branch

# Move your feature's starting point to the absolute latest commit on main
git rebase main

# --- The Two Ways to Do It ---

## 1. `git switch -c <branch-name>` (Recommended)
The `-c` stands for **create**. This is the modern, cleaner Git command introduced to replace the confusing `checkout` command.

## 2. `git checkout -b <branch-name>` (Classic)
The `-b` stands for **branch**. This is the older, classic command that does the exact same thing. You will still see this used in most tutorials.


# 1. How to Delete a Feature Branch
Yes, you must switch to the main branch first. Git will not let you delete a branch that you are currently standing on.Once you are on main, use one of these commands:

**`git branch -d my-new-feature`** (Safe)
Use this if you have already merged your code. Git will warn you and stop if you have unmerged work.

**`git branch -D my-new-feature`** (Force)
Use the capital -D if you want to completely trash the branch and all its changes, even if they were never merged.

**💡 The Professional Way to Switch Safely: Git Stash**If you need to switch branches quickly but aren't ready to make a messy commit, use **`git stash`**. This puts your edits into a temporary storage box and gives you a clean workbench.

# 1. Save your changes into a hidden stash and clear your workspace
git stash

# 2. Now you can switch branches safely
git checkout main

# 3. When you come back later, restore your work exactly where you left off
git checkout my-new-feature
git stash pop