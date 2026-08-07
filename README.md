# sort-lines

Sort, reverse, shuffle, and deduplicate text lines.

Commands operate on every non-empty selection, or on the entire buffer when nothing is selected.

## Features

- **Alphabetic ordering**: sort text with case-sensitive or case-insensitive comparison.
- **Natural ordering**: order embedded numbers by their numeric values.
- **Length ordering**: arrange text from shortest to longest.
- **Reverse ordering**: sort descending or reverse the current order.
- **Random ordering**: shuffle text into a random order.
- **Duplicate removal**: remove repeated text while retaining the first occurrence.
- **Multiple selections**: process each selected group independently.

## Installation

To install `sort-lines` search for _sort-lines_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/sort-lines`.

## Commands

Commands available in `atom-workspace`:

- `sort-lines:sort`: sort alphabetically,
- `sort-lines:case-insensitive-sort`: sort alphabetically while ignoring case,
- `sort-lines:natural`: sort embedded numbers by numeric value,
- `sort-lines:reverse-sort`: sort alphabetically in descending order,
- `sort-lines:by-length`: sort from shortest to longest,
- `sort-lines:shuffle`: shuffle into a random order,
- `sort-lines:reverse`: reverse the current order,
- `sort-lines:unique`: remove duplicate text.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
