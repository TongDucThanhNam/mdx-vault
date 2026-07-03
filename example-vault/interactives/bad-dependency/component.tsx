import debounce from 'lodash/debounce'

export default function BadDependency(): React.JSX.Element {
  debounce(() => undefined, 100)

  return <div>This component must not run.</div>
}
