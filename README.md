
### file-detect

detect target file in project

## Install


```
pnpm add file-detect -D
```

## Usage

```
file-detect  search src/components/Page --ext .tsx --paths @=src --source src
```

### Use with lint-staged

.lintstagedrc:

```
{
	"src/**/*.{ts,tsx,js,jsx}": "file-detect search --ext .tsx --paths @=src --source src --pdf",
}
```